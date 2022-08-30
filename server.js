const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const validate = require("mongoose-validator");
const { graphqlHTTP } = require("express-graphql");
const { loadSchema } = require("@graphql-tools/load");
const { GraphQLFileLoader } = require("@graphql-tools/graphql-file-loader");
const { makeExecutableSchema } = require("@graphql-tools/schema");

dotenv.config();
const DEBUG = !/\s*(?:0|false)\s*/i.test(process.env.DEBUG);

const app = express();
app.use(express.json());

const nameValidator = [
  validate({
    validator: "isLength",
    arguments: 3,
    message: "Must be atleast {ARGS[0]} characters",
  }),
];

const emailValidator = [
  validate({
    validator: "isEmail",
    message: "Must be a valid email",
  }),
];

const UserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      validate: nameValidator,
    },
    lastName: {
      type: String,
      validate: nameValidator,
    },
    username: {
      type: String,
      validate: nameValidator,
    },
    email: {
      type: String,
      validate: emailValidator,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    statics: {
      findByUsername(username) {
        return this.findOne({ username });
      },
      findByEmail(email) {
        return this.findOne({ email });
      },
    },
    virtuals: {
      fullName: {
        get() {
          return `${this.firstName} ${this.lastName}`;
        },
      },
    },
  }
);

const User = mongoose.model("User", UserSchema);

app.get("/users", async (req, res) => {
  const users = await User.find();
  return res.json(users);
});

app.get("/users/:username", async (req, res) => {
  const { username } = req.params;
  const user = await User.findByUsername(username).populate("followers");
  return res.json(user);
});

app.post("/users", async (req, res) => {
  const user = await User.create(req.body);
  return res.status(201).json(user);
});

const typeDefs = async () =>
  await loadSchema("./schema.graphql", {
    loaders: [new GraphQLFileLoader()],
  });

const resolvers = {
  Query: {
    users: async () => {
      return await User.find();
    },
    user: async (parent, args, context, info) => {
      const { username } = args;
      return await User.findByUsername(username);
    },
  },
  Mutation: {
    createUser: async (parent, args, context, info) => {
      const { user } = args;
      return await User.create(user);
    },
  },
};

app.use("/graphql", async (...args) => {
  return graphqlHTTP({
    schema: makeExecutableSchema({ typeDefs: await typeDefs(), resolvers }),
    graphiql: DEBUG,
  })(...args);
});

const main = async () => {
  const mongoConfig = {
    host: process.env["MONGO_HOST"] || "127.0.0.1",
    port: process.env["MONGO_PORT"] || "27017",
    user: process.env["MONGO_USER"] || "root",
    password: process.env["MONGO_PASSWORD"] || "root",
    dbname: process.env["MONGO_DBNAME"] || "admin",
  };
  const url = Object.entries(mongoConfig).reduce((url, [key, value]) => {
    return url.replace(`<${key}>`, value);
  }, process.env["MONGO_URL"]);
  await mongoose.connect(url);
  mongoose.connection.on("error", (error) => console.log(error));

  const port = 8002;
  app.listen(port, () => {
    console.log(`Server listening at 0.0.0.0:${port}`);
  });
};

main().catch((e) => console.error(e));
