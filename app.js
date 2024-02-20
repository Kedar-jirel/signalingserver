let port = process.env.PORT || 3000;

let IO = require("socket.io")(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// define session map
const sessionMap = new Map();

IO.use((socket, next) => {
  if (socket.handshake.query) {
    let callerId = socket.handshake.query.callerId;
    socket.user = callerId;
    next();
  }
});
// Assuming you have a mechanism to store session state
let activeCalls = {};

IO.on("connection", (socket) => {
  console.log(socket.user, "Connected");
  socket.join(socket.user);

  socket.on("makeCall", (data) => {
    let calleeId = data.calleeId;
    let sdpOffer = data.sdpOffer;

    socket.to(calleeId).emit("newCall", {
      callerId: socket.user,
      sdpOffer: sdpOffer,
    });

    // Store the session state for the call
    activeCalls[socket.user] = activeCalls[socket.user] || {};
    activeCalls[socket.user][calleeId] = {
      sdpOffer: sdpOffer,
    };

    // // add session values to variable
    // let session = {
    //   sdpOffer: sdpOffer
    // }

    // // assign session values to session
    // sessionMap.set(calleeId, session);

    // console.log('session user ' + calleeId);
    // console.log('session value' + session);
  });

  socket.on("answerCall", (data) => {
    let callerId = data.callerId;
    let sdpAnswer = data.sdpAnswer;

    socket.to(callerId).emit("callAnswered", {
      callee: socket.user,
      sdpAnswer: sdpAnswer,
    });

    // Update session state for the call
    if (activeCalls[callerId] && activeCalls[callerId][socket.user]) {
      activeCalls[callerId][socket.user].sdpAnswer = sdpAnswer;
    }
  });

  socket.on("IceCandidate", (data) => {
    let calleeId = data.calleeId;
    let iceCandidate = data.iceCandidate;

    socket.to(calleeId).emit("IceCandidate", {
      sender: socket.user,
      iceCandidate: iceCandidate,
    });
  });

  socket.on("resumeCall", (data) => {
    let callerId = data.callerId;
    let calleeId = socket.user;

    if (activeCalls[callerId] && activeCalls[callerId][calleeId]) {
      let sessionState = activeCalls[callerId][calleeId];
      IO.emit("callResumed", sessionState);
    } else {
      // Handle error: Session state not found
      IO.emit("resumeCallError", { message: "Session state not found" });
    }
  });

  socket.on('onScanCompleted', (data) => {
    let calleeId = data.calleeId;
    IO.emit("onConnected", {
      calleeId: calleeId,
    });
  });
  
  socket.on('reInitiateCall', (data) => {
    console.log("reInititeCall");
    let callerId = data.callerId;
    IO.emit('reconnect-user-' + callerId, {
      message: "Please re-initiate monitoring"
    });

  });

  socket.on("disconnect", () => {
    // Cleanup session state on disconnect
    if (activeCalls[socket.user]) {
      // delete session for user which returned sdpoffer
      delete activeCalls[socket.user];
    }
  });
});