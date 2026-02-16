require("dotenv").config();

const path = require("path"),
  port = 8080,
  allowedOrigins = ["https://z2xlch.csb.app"], //Origin: <scheme>://<hostname>:<port>
  RESSEND = (res, e) => {
    res.send(e);
    //res.end();
  },
  refererOrigin = (req, res) => {
    var origin = req.query.origin;
    if (!origin) {
      origin = req.headers.origin;
      //"no newaccount made body",  //...printObject(req) //: origin + " " + (storeId ? "storeId" : "")
    }
    return origin;
  },
  allowOriginType = (origin, req, res) => {
    // Handle undefined origin from non-browser clients (e.g., Android app)
    const allowOrigin =
      req.path.includes("/attend") || req.path.includes("/status") || !origin
        ? "*"
        : origin;
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Methods", ["POST", "OPTIONS", "GET"]);
    res.setHeader("Access-Control-Allow-Headers", [
      "Content-Type",
      "Authorization",
      "Access-Control-Request-Method",
      "Access-Control-Request-Methods",
      "Access-Control-Request-Headers"
    ]);

    res.setHeader("Allow", ["POST", "OPTIONS", "GET"]);
    res.setHeader("Content-Type", "Application/JSON");
    var goAhead = true;
    if (!goAhead) return true;
  },
  preflight = (req, res) => {
    const origin = req.headers.origin;
    app.use(cors({ origin })); //https://stackoverflow.com/questions/36554375/getting-the-req-origin-in-express
    if (
      [
        ...(req.path.includes("/users") ||
        req.path.includes("/create") ||
        req.path.includes("/delete")
          ? allowedOrigins
          : [req.headers.origin])
      ].indexOf(req.headers.origin) === -1
    )
      return res.send({
        statusCode: 401,
        error: "no access for this origin- " + req.headers.origin
      });
    if (allowOriginType(origin, req, res))
      return res.send({
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      }); //"Cannot setHeader headers after they are sent to the client"

    res.send({
      statusCode: 204
    }); //res.sendStatus(200);
  },
  timeout = require("connect-timeout"),
  //fetch = require("node-fetch"),
  express = require("express"),
  app = express(),
  issue = express.Router(),
  cors = require("cors"),
  { initializeApp, applicationDefault, cert } = require("firebase-admin/app"),
  {
    getFirestore,
    Timestamp,
    FieldValue,
    Filter
  } = require("firebase-admin/firestore"),
  { getAuth } = require("firebase-admin/auth");

const jsonData = require("./passport-service.json");

initializeApp({
  credential: cert(jsonData)
});

const db = getFirestore();

app.use(timeout("10s"));

//catches ctrl+c event
process.on("SIGINT", exitHandler.bind(null, { exit: true }));

// catches "kill pid" (for example: nodemon restart)
process.on("SIGUSR1", exitHandler.bind(null, { exit: true }));
process.on("SIGUSR2", exitHandler.bind(null, { exit: true }));

const nonbody = express
  .Router()
  .get("/", (req, res) => res.status(200).send("home path"))
  .options("/*", preflight);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

var statusCode = 200,
  statusText = "ok";
issue
  .get("/status", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });

    // Verify Firebase ID token
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "Missing authorization token" });
    }
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "Invalid authorization token" });
    }
    const studentId = (decoded.email || "").split("@")[0];
    if (!studentId) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "No email in token" });
    }

    // Validate eventId input
    const eventId = req.query.eventId;
    if (typeof eventId !== "string" || !eventId.trim()) {
      return res.status(400).send({
        statusCode: 400,
        message: "eventId must be a non-empty string"
      });
    }
    if (eventId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
      return res
        .status(400)
        .send({ statusCode: 400, message: "eventId has invalid format" });
    }

    try {
      const evenT = await db.collection("events").doc(eventId).get();
      if (!evenT.exists) {
        return res.status(404).send({
          statusCode: 404,
          statusText,
          message: eventId + " event doesn't exist"
        });
      }
      const event = evenT.data();

      if (!Array.isArray(event.attendees)) {
        console.error("Event attendees is not an array:", eventId, event);
        return res
          .status(500)
          .send({ statusCode: 500, message: "Invalid event data structure" });
      }

      const hasAttended = event.attendees.includes(studentId);
      return res.send({
        statusCode,
        statusText,
        hasAttended,
        title: event.title || ""
      });
    } catch (err) {
      console.error("Database error in /status:", err);
      return res
        .status(500)
        .send({ statusCode: 500, message: "Database error: " + err.message });
    }
  })
  .post("/attend", async (req, res) => {
    if (allowOriginType(req.headers.origin, req, res))
      return RESSEND(res, {
        statusCode,
        statusText: "not a secure origin-referer-to-host protocol"
      });

    // Verify Firebase ID token
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!idToken) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "Missing authorization token" });
    }
    let decoded;
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "Invalid authorization token" });
    }
    const studentId = (decoded.email || "").split("@")[0];
    if (!studentId) {
      return res
        .status(401)
        .send({ statusCode: 401, message: "No email in token" });
    }

    // Validate inputs
    const eventId = req.body.eventId;
    const code = req.body.code;
    const fullName = req.body.fullName;
    const address = req.body.address;

    if (typeof eventId !== "string" || !eventId.trim()) {
      return res.status(400).send({
        statusCode: 400,
        message: "eventId must be a non-empty string"
      });
    }
    if (eventId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(eventId)) {
      return res
        .status(400)
        .send({ statusCode: 400, message: "eventId has invalid format" });
    }
    const hasCode = typeof code === "string" && code.trim().length > 0;
    if (hasCode && !/^[a-zA-Z0-9]+$/.test(code)) {
      return res
        .status(400)
        .send({ statusCode: 400, message: "code has invalid format" });
    }
    if (fullName !== undefined && typeof fullName !== "string") {
      return res
        .status(400)
        .send({ statusCode: 400, message: "fullName must be a string" });
    }
    if (address !== undefined && typeof address !== "string") {
      return res
        .status(400)
        .send({ statusCode: 400, message: "address must be a string" });
    }

    try {
      // Validate one-time code (optional)
      const codeDocId = studentId + "_" + eventId;
      if (hasCode) {
        const codeDoc = await db
          .collection("attendanceCodes")
          .doc(codeDocId)
          .get();
        if (!codeDoc.exists || codeDoc.data().code !== code) {
          return res.status(403).send({
            statusCode: 403,
            message: "Invalid or missing attendance code"
          });
        }
      }

      const evenT = await db.collection("events").doc(eventId).get();
      if (!evenT.exists) {
        return res.send({
          statusCode,
          statusText,
          message: eventId + " event doesn't exist",
          title: ""
        });
      }
      const event = evenT.data();

      // Validate event data structure
      if (!Array.isArray(event.attendees)) {
        console.error("Event attendees is not an array:", eventId, event);
        return res
          .status(500)
          .send({ statusCode: 500, message: "Invalid event data structure" });
      }

    if (event.attendees.includes(studentId)) {
      // Clean up the code since they already attended
      if (hasCode) {
        await db.collection("attendanceCodes").doc(codeDocId).delete();
      }
      return res.send({
        statusCode,
        statusText,
        message: "already attended.",
        title: event.title
      });
    }

      await db
        .collection("events")
        .doc(eventId)
        .update({
          attendees: FieldValue.arrayUnion(studentId)
        });
      await db
        .collection("leaders")
        .doc(studentId)
        .set(
          {
            eventsAttended: FieldValue.increment(1),
            address: address || "",
            fullName: fullName || ""
          },
          { merge: true }
        );
      // Delete the one-time code after successful attendance
      if (hasCode) {
        await db.collection("attendanceCodes").doc(codeDocId).delete();
      }
      res.send({
        statusCode,
        statusText,
        message: "attended",
        title: event.title
      });
    } catch (err) {
      console.error("Database error in /attend:", err);
      return res
        .status(500)
        .send({ statusCode: 500, message: "Database error: " + err.message });
    }
  });
//https://stackoverflow.com/questions/31928417/chaining-multiple-pieces-of-middleware-for-specific-route-in-expressjs
app.use("/api", nonbody, issue); //methods on express.Router() or use a scoped instance

app.get("/health", (req, res) => res.status(200).send("ok"));

app.listen(port, () => console.log(`localhost:${port}`));
process.stdin.resume(); //so the program will not close instantly
function exitHandler(exited, exitCode) {
  if (exited) {
    //mccIdTimeoutNames.forEach((x) => clearTimeout(mccIdTimeouts[x]));
    console.log("clean");
  }
  if (exitCode || exitCode === 0) console.log(exitCode);
  if (exited.mounted) process.exit(); //bind-only not during declaration
} //bind declare (this,update) when listened on:
process.on("uncaughtException", exitHandler.bind(null, { mounted: true }));
process.on("exit", exitHandler.bind(null, { clean: true }));
function errorHandler(err, req, res, next) {
  console.error("Error handler caught:", err);

  // Don't try to send response if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  res.status(500).send({
    statusCode: 500,
    statusText: "Internal Server Error",
    message: err.message || "An unexpected error occurred"
  });
}
app.use(errorHandler);
