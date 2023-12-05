// import * as express from "express";
import express from "express";
import path from "path";

require('dotenv').config();
let serverPort = process.argv[2];
// console.log("PORT:", serverPort);


const app = express();

// Serve the static files from the React app

app.get('/', (req,res) =>{
    res.sendFile(path.join(path.resolve(__dirname, "."), '/index.html'));
});

app.use('/', express.static(path.join(__dirname, "./")));
// app.use('/', express.static(path.join(__dirname, "./public")));



// app.get("*", (req, res)=>{
    // console.log(req.originalUrl);
    // console.log("404 not found");
    // res.status(404).send();
//     res.redirect("/");
// })

const port = serverPort || process.env.PORT || 5000;
app.listen(port);

console.log('App is listening on port ' + port);