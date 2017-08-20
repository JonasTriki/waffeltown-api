const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer().single("image");
const inspect = require('util').inspect;
const recog = require("../vision/recognition");
const fs = require('fs');
const uuidv1 = require('uuid/v1');
const uuidv4 = require('uuid/v4');
const MongoClient = require("mongodb").MongoClient;
const mongoUrl = "mongodb://localhost:27017/waffeltown";

router.get("/", function(req, res, next) {

    // Connect to MongoDB Server
    MongoClient.connect(mongoUrl, function(err, db) {
        if (err) console.log("Unable to connect to the server", err);

        var collection = db.collection("waffels");
        collection.find({}).sort({date: -1}).toArray((err, result) => {
            if (err) {
                res.send(err);
            } else {
                res.send(result);
            }
            db.close();
        });
    });
});

function findWaffel(id, err, cb) {

    // Connect to MongoDB Server
    MongoClient.connect(mongoUrl, function(err, db) {
        if (err) console.log("Unable to connect to the server", err);

        // Check if waffel exists
        var collection = db.collection("waffels");
        collection.findOne({"_id": id}, (err, waffel) => {
            if (err) {
                err(err);
            } else {
                cb(waffel);
            }
            db.close();
        });
    });
}

router.get("/:id", function(req, res, next) {

    // Validate waffel id
    req.checkParams("id", "Waffel id has to be valid").isUuidV4();
    req.getValidationResult().then((result) => {
        if (!result.isEmpty()) {
            console.log("Validation errors: ", inspect(result.array()));
            res.send(inspect(result.array()));
            return;
        }

        findWaffel(req.params.id, (err) => {
            res.send(err);
        }, (waffel) => {
            if (waffel == null) {
                res.send("Could not find waffel with id " + req.params.id);
            } else {
                res.send(waffel);
            }
        });
    });
});

router.post("/", upload, function(req, res, next) {

    // Validate POST data
    if (req.file == undefined) {
        console.log("Waffel image must be provided");
        res.send("No waffel image.");
        return;
    }

    req.checkBody("rating", "Waffel rating cannot be empty").notEmpty();
    req.checkBody("rating", "Waffel rating must be a number").isInt();
    req.checkBody("rating", "Waffel rating must be greater than 1").greaterThanEqual(1);
    req.checkBody("rating", "Waffel rating must be less or equal to 5").lessThanEqual(5);

    req.checkBody("description", "Waffel description cannot be empty").notEmpty();
    req.checkBody("description", "Waffel description cannot be larger than 140 characters").maxLength(140);

    req.checkBody("topping", "Waffel topping cannot be empty").notEmpty();

    req.checkBody("consistency", "Waffel consistency cannot be empty").notEmpty();
    req.checkBody("consistency", "Waffel consistency must be a number").isInt();
    req.checkBody("consistency", "Waffel consistency must be greater than 1").greaterThanEqual(1);
    req.checkBody("consistency", "Waffel consistency must be less or equal to 3").lessThanEqual(3);

    req.getValidationResult().then((result) => {
        if (!result.isEmpty()) {
            console.log("Validation errors: ", inspect(result.array()));
            res.send(inspect(result.array()));
            return;
        }

        // Everything is good so far, next up: waffel recognition.
        var base64 = req.file.buffer.toString("base64");
        recog.recognizeWaffel(base64, (result) => {
            if (result.isWaffel) {

                // Save waffel and add entry to DB.
                // TODO: check if we should use other filetypes aswell (jpg etc).
                var waffelPath = "waffels/" + uuidv1() + ".png";
                fs.writeFile(waffelPath, req.file.buffer, (err) => {
                    if (err) {
                        res.send("Could not save waffel?");
                        throw err;
                    }

                    // Connect to MongoDB Server
                    MongoClient.connect(mongoUrl, function(err, db) {
                        if (err) console.log("Unable to connect to the server", err);

                        var collection = db.collection("waffels");
                        collection.insert({
                            "_id": uuidv4(),
                            "date": new Date(),
                            "comments": [],
                            "upwaffels": 0,
                            "upwaffelDevices": [],
                            "rating": +req.body.rating,
                            "description": req.body.description,
                            "topping": req.body.topping,
                            "consistency": +req.body.consistency,
                            "image": "/" + waffelPath
                        });
                        res.send("ok");
                    });
                });
            } else {
                res.send("No waffel found in image.");
            }
        });
    });
});

function upWaffel(id, deviceId, incr, errCb, okCb) {
    findWaffel(id, (err) => {
        errCb(err);
    }, (waffel) => {
        if (waffel == null) {
            errCb("Could not find waffel with id " + id);
        } else {

            // Check if upwaffel device exists, and if it does, check if we are able to upwaffel/downwaffel.
            var hasUpwaffeled = false;
            var canUpwaffel = true;
            for (var i = 0; i < waffel.upwaffelDevices.length; i++) {
                var devId = waffel.upwaffelDevices[i]["_id"];
                if (devId.substring(1) == deviceId) {
                    hasUpwaffeled = true;
                    canUpwaffel = devId.charAt(0) == (incr > 0 ? "-" : "+");
                    break;
                }
            }
            if (!canUpwaffel) {
                errCb("Cannot up/downwaffel id " + id);
                return;
            }

            // Connect to MongoDB Server
            MongoClient.connect(mongoUrl, function(err, db) {
                if (err) console.log("Unable to connect to the server", err);

                var collection = db.collection("waffels");
                if (hasUpwaffeled) {
                    collection.updateOne(
                        {"_id": id, "upwaffelDevices._id": (incr > 0 ? "-" : "+") + deviceId},
                        {$set: {
                            "upwaffelDevices.$._id": (incr > 0 ? "+" : "-") + deviceId
                        }, $inc: {
                            upwaffels: incr * 2
                        }},
                        (error, upwaffel) => {
                            if (error) {
                                errCb(error);
                            } else {
                                okCb();
                            }
                        }
                    );
                } else {
                    collection.updateOne(
                        {"_id": id},
                        {$push: {
                            upwaffelDevices: {
                                "_id": (incr > 0 ? "+" : "-") + deviceId
                            }
                        }, $inc: {upwaffels: incr}},
                        (error, upwaffel) => {
                            if (error) {
                                errCb(error);
                            } else {
                                okCb();
                            }
                        }
                    );
                }
            });
        }
    });
}

router.post("/:id/upwaffel", function(req, res, next) {

    // Validate waffel id and device id
    req.checkParams("id", "Waffel id has to be valid").isUuidV4();
    req.checkBody("device_id", "Device id cannot be empty").notEmpty();
    req.getValidationResult().then((result) => {
        if (!result.isEmpty()) {
            console.log("Validation errors: ", inspect(result.array()));
            res.send(inspect(result.array()));
            return;
        }

        // Increase upwaffel count by one.
        upWaffel(req.params.id, req.body.device_id, 1, (err) => {
            res.send(err);
        }, () => {
            res.send("ok");
        });
    });
});

router.post("/:id/downwaffel", function(req, res, next) {

    // Validate waffel id and device id
    req.checkParams("id", "Waffel id has to be valid").isUuidV4();
    req.checkBody("device_id", "Device id cannot be empty").notEmpty();
    req.getValidationResult().then((result) => {
        if (!result.isEmpty()) {
            console.log("Validation errors: ", inspect(result.array()));
            res.send(inspect(result.array()));
            return;
        }

        // Decrease upwaffel count by one.
        upWaffel(req.params.id, req.body.device_id, -1, (err) => {
            res.send(err);
        }, () => {
            res.send("ok");
        });
    });
});

router.post("/:id/comment", function(req, res, next) {

    // Validate waffel id and comment string
    req.checkParams("id", "Waffel id has to be valid").isUuidV4();
    req.checkBody("comment", "Waffel comment cannot be empty").notEmpty();
    req.getValidationResult().then((result) => {
        if (!result.isEmpty()) {
            console.log("Validation errors: ", inspect(result.array()));
            res.send(inspect(result.array()));
            return;
        }

        // Connect to MongoDB Server
        MongoClient.connect(mongoUrl, function(err, db) {
            if (err) console.log("Unable to connect to the server", err);

            // Check if waffel exists
            var collection = db.collection("waffels");
            collection.updateOne(
                {"_id": req.params.id},
                {$push: {
                    comments: {
                        text: req.body.comment,
                        date: new Date()
                    }
                }},
                (error, waffel) => {
                    if (error) {
                        console.log(error);
                        res.send("Could not comment waffel with id " + req.params.id);
                    } else {
                        res.send("ok");
                    }
                }
            );
            db.close();
        });
    });
});

module.exports = router;
