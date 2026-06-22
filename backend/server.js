const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.send("AI Study Planner Backend Running");
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});