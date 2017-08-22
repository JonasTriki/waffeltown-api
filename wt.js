const path = require("path");
const express = require("express");
const favicon = require("serve-favicon");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const expressValidator = require("express-validator");
const MongoClient = require("mongodb").MongoClient;
const mongoUrl = "mongodb://localhost:27017/waffeltown";

const api = require("./routes/api");

const app = express();
const http = require("http");
const port = 8082;
const server = http.Server(app).listen(port);
console.log("Server started.");

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressValidator({
    customValidators: {
        isArray: function(value) {
            if (value === undefined) {
                return false;
            } else {
                return Array.isArray(value);
            }
        },
        greaterThanEqual: function(param, num) {
            if (param === undefined) {
                return false;
            } else {
                return param >= num;
            }
        },
        lessThanEqual: function(param, num) {
            if (param === undefined) {
                return false;
            } else {
                return param <= num;
            }
        },
        maxLength: function (param, num) {
            if (param === undefined) {
                return false;
            } else {
                return param.length <= num;
            }
        },
        isUuidV4: function(uuid) {
            if (uuid === undefined) {
                return false;
            }
            let regex = /^[0-9A-F]{8}-[0-9A-F]{4}-[4][0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i;
            return regex.test(uuid);
        }
    }
}));
app.use(cookieParser());

app.use("/api", api);
app.use(express.static(__dirname));
app.use(function(req, res) {
    res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8"
    });
    res.end('API for Waffel Town.<br><a href="https://github.com/JonasTriki/waffeltown-api">https://github.com/JonasTriki/waffeltown-api</a>');
});
