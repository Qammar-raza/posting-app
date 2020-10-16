const fs = require("fs");
const path = require("path");

const { validationResult } = require("express-validator/check");
const Post = require("../models/post");
const User = require("../models/user");
const io = require("../socket");

exports.getPosts = (req, res, next) => {
  const currentPage = req.query.page || 1;
  const perpage = 2;
  let totalItems;
  Post.find()
    .countDocuments()
    .then((count) => {
      totalItems = count;
      return Post.find()
        .populate("creator")
        .sort({ createdAt: -1 })
        .skip((currentPage - 1) * perpage)
        .limit(perpage);
    })
    .then((posts) => {
      res.status(200).json({
        message: "Posts Fetched Succcessfully",
        posts: posts,
        totalItems: totalItems,
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
        next(err);
      }
    });
};

exports.getPost = (req, res, next) => {
  const postId = req.params.postId;
  console.log(postId);
  Post.findById(postId)
    .then((post) => {
      console.log(post);
      if (!post) {
        const error = new Error("No post with the id was found");
        error.statusCode = 404;
        throw error;
      }
      res.status(200).json({ message: "Post Fetched", post: post });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
        next(err);
      }
    });
};

exports.createPost = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const error = new Error("Validation Failed, Entered data is incorrect !");
    error.statusCode = 422;
    throw error;
  }
  if (!req.file) {
    const error = new Error("File not provided !");
    error.statusCode = 422;
    throw error;
  }
  const imageUrl = req.file.path;
  const title = req.body.title;
  const content = req.body.content;
  let creator;
  const post = new Post({
    title: title,
    imageUrl: imageUrl,
    content: content,
    creator: req.userId,
  });

  post
    .save()
    .then((result) => {
      return User.findById(req.userId);
    })
    .then((user) => {
      creator = user;
      user.posts.push(post);
      return user.save();
      // console.log(result);
    })
    .then((result) => {
      console.log(result);
      io.getIO().emit("posts", {
        actions: "create",
        post: {
          ...post._doc,
          creator: { _id: req.userId, name: result.name },
        },
      });
      res.status(201).json({
        message: "Post created successfully !",
        post: post,
        creator: { _id: creator._id, name: creator.name },
      });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
        next(err);
    });
};

exports.updatePost = (req, res, next) => {
  const postId = req.params.postId;
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const error = new Error("Validation Failed, Entered data is incorrect !");
    error.statusCode = 422;
    throw error;
  }
  const title = req.body.title;
  const content = req.body.content;
  let imageUrl = req.body.image;
  if (req.file) {
    imageUrl = req.file.path;
  }
  if (!imageUrl) {
    const error = new Error("No File Picked!!");
    error.statusCode = 422;
    throw error;
  }

  Post.findById(postId)
    .populate("creator")
    .then((post) => {
      if (!post) {
        const error = new Error("No post with the id was found");
        error.statusCode = 404;
        throw error;
      }
      if (post.creator._id.toString() !== req.userId.toString()) {
        const error = new Error("Not authorized !");
        error.statusCode = 403;
        throw error;
      }
      if (imageUrl !== post.imageUrl) {
        clearPath(post.imageUrl);
      }
      post.title = title;
      post.content = content;
      post.imageUrl = imageUrl;
      return post.save();
    })
    .then((result) => {
      // console.log(result);
      io.getIO().emit("posts", { actions: "update", post: result });
      res
        .status(200)
        .json({ message: "Post updated Successfully", post: result });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

exports.deletePost = (req, res, next) => {
  const postId = req.params.postId;
  Post.findById(postId)
    .then((post) => {
      if (!post) {
        const error = new Error("No post with the id was found");
        error.statusCode = 404;
        throw error;
      }
      if (post.creator.toString() !== req.userId.toString()) {
        const error = new Error("Not authorized !");
        error.statusCode = 403;
        throw error;
      }
      clearPath(post.imageUrl);
      return Post.findByIdAndRemove(postId);
      // CHECK LOGIN USER
    })
    .then((result) => {
      return User.findById(req.userId);
    })
    .then((user) => {
      user.posts.pull(postId);
      return user.save();
    })
    .then((result) => {
      io.getIO().emit("posts", { action: "delete", post: postId });
      res.status(200).json({ message: "Post Deletion Successful" });
    })
    .catch((err) => {
      if (!err.statusCode) {
        err.statusCode = 500;
      }
      next(err);
    });
};

const clearPath = (filePath) => {
  filePath = path.join(__dirname, "..", filePath);
  fs.unlink(filePath, (err) => console.log(err));
};
