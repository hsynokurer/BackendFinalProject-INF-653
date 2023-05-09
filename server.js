const express = require("express");
const app = express();
const States = require("./models/states");
const bodyParser = require("body-parser");
const path = require("path");
const cors = require("cors");

const whitelist = [
  "https://dazzling-snickerdoodle-777101.netlify.app",
  "http://localhost:3500",
];
const corsOptions = {
  origin: (origin, callback) => {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  optionSuccessStatus: 00,
};
app.use(cors(corsOptions));

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://mongotut:testing123@cluster0.79wxkae.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let statesDataIncludeFunFacts;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

async function concatFunFactsForStates() {
  connectToDB();
  const statesData = require("./models/statesData.json");
  const stateCodes = statesData.map((state) => state.code);

  const dbStates = await Promise.all(
    stateCodes.map((stateCode) =>
      States.findOne({ stateCode }, null, { maxTimeMS: 30000 })
    )
  );
  statesDataIncludeFunFacts = statesData.map((state, index) => {
    const dbState = dbStates[index];
    const funFacts = dbState ? dbState.funfacts : [];
    return funFacts.length > 0 ? { ...state, funfacts: funFacts } : state;
  });
}

async function run() {
  await concatFunFactsForStates();
}
run().catch(console.dir);

app.get("/", cors(), (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/states/", async (req, res) => {
  try {
    const path = req.path;
    let filteredStatesData;

    if (path === "/states/") {
      filteredStatesData = statesDataIncludeFunFacts;

      if (path === "/states/" && req.query.contig === "true") {
        filteredStatesData = filteredStatesData.filter(
          (state) => state.code !== "AK" && state.code !== "HI"
        );
      } else if (path === "/states/" && req.query.contig === "false") {
        filteredStatesData = filteredStatesData.filter(
          (state) => state.code === "AK" || state.code === "HI"
        );
      }
    } else {
      res.status(404).send("Page not found");
      return;
    }

    const formattedData = JSON.stringify(filteredStatesData, null, 2);
    res.set("Content-Type", "application/json");
    res.send(formattedData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

app.get("/states/:state", async (req, res) => {
  let filteredStatesData;
  const list = statesDataIncludeFunFacts;
  const stateCode = req.params.state.toUpperCase();
  const stateData = await list.find((state) => state.code === stateCode);
  if (stateData) {
    filteredStatesData = await statesDataIncludeFunFacts.find(
      (state) => state.code === stateCode
    );
    if (filteredStatesData) {
      const formattedData = JSON.stringify(filteredStatesData, null, 2);
      res.set("Content-Type", "application/json");
      res.send(formattedData);
    } else {
      res.status(404).send("State not found");
    }
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.get("/states/:state/funfact", async (req, res) => {
  const list = statesDataIncludeFunFacts;
  const stateCode = req.params.state.toUpperCase();
  const stateData = await list.find((state) => state.code === stateCode);
  if (stateData) {
    if ("funfacts" in stateData) {
      if (stateData.funfacts.length > 0) {
        const formattedData =
          stateData.funfacts[
            Math.floor(Math.random() * stateData.funfacts.length)
          ];
        const response = { funfact: formattedData };
        res.set("Content-Type", "application/json");
        res.send(response);
      }
    } else {
      res
        .status(404)
        .json({ message: "No Fun Facts found for " + stateData.state });
    }
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.post("/states/:state/funfact", async (req, res) => {
  try {
    const stateCode = req.params.state.toUpperCase();
    const newFunFacts = req.body.funfacts;
    if (!newFunFacts) {
      res.status(400).send({ message: "State fun facts value required" });
      return;
    }
    if (!Array.isArray(newFunFacts)) {
      res
        .status(400)
        .send({ message: "State fun facts value must be an array" });
      return;
    }

    let stateData = await States.findOne({ stateCode });

    if (!stateData) {
      stateData = new States({ stateCode: stateCode, funfacts: newFunFacts });
    }

    stateData.funfacts.push(...newFunFacts);

    stateData = await stateData.save();

    await concatFunFactsForStates();
    res.status(200).send(stateData);
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: "Internal Server Error" });
  }
});

app.patch("/states/:state/funfact", async (req, res) => {
  try {
    const stateCode = req.params.state.toUpperCase();
    const funfact = req.body.funfact;
    const index = req.body.index;

    if (!funfact) {
      res.status(400).send({ message: "State fun fact value required" });
      return;
    }
    if (!index) {
      res.status(400).send({ message: "State fun fact index value required" });
      return;
    }
    if (!statesDataIncludeFunFacts) {
      await concatFunFactsForStates();
    }
    const list = statesDataIncludeFunFacts;

    const stateInfo = await list.find((state) => state.code === stateCode);
    if (stateInfo) {
      const zeroBasedIndex = index - 1;
      const stateData = await States.findOne({ stateCode });
      if (stateData) {
        if ("funfacts" in stateData) {
          if (stateData.funfacts.length > 0) {
            // Replace the existing fun fact with the new one at the specified index
            const funfacts = stateData.funfacts;
            if (zeroBasedIndex >= 0 && zeroBasedIndex < funfacts.length) {
              funfacts[zeroBasedIndex] = funfact;
            } else {
              return res.status(400).send({
                message:
                  "No Fun Fact found at that index for " + stateInfo.state,
              });
            }

            const updatedState = await stateData.save();

            await concatFunFactsForStates();
            res.send(updatedState);

            return;
          }
        }
      } else {
        res
          .status(400)
          .json({ message: "No Fun Facts found for " + stateInfo.state });
      }
    } else {
      res.status(404).json({ message: "Invalid state abbreviation parameter" });
    }
  } catch (err) {
    res.status(500).send(err);
  }
});

app.delete("/states/:state/funfact", cors(), async (req, res) => {
  const stateCode = req.params.state.toUpperCase();
  const index = req.body.index;
  const list = statesDataIncludeFunFacts;

  if (!index) {
    res.status(400).send({ message: "State fun fact index value required" });
    return;
  }
  const stateInfo = await list.find((state) => state.code === stateCode);

  if (stateInfo) {
    const zeroBasedIndex = index - 1;
    const stateData = await States.findOne({ stateCode });
    if (stateData) {
      if ("funfacts" in stateData) {
        if (zeroBasedIndex < stateData.funfacts.length) {
          stateData.funfacts.splice(zeroBasedIndex, 1);
          const updatedState = await stateData.save();
          res.status(200).send(updatedState);
        } else {
          return res.status(400).json({
            message: "No Fun Fact found at that index for " + stateInfo.state,
          });
        }
      }
    } else {
      res
        .status(400)
        .json({ message: "No Fun Facts found for " + stateInfo.state });
    }
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.get("/states/:state/capital", cors(), async (req, res) => {
  const stateCode = req.params.state.toUpperCase();
  let state = await statesDataIncludeFunFacts.find(
    (state) => state.code === stateCode
  );

  if (state) {
    const formattedData = JSON.stringify(
      {
        state: state.state,
        capital: state.capital_city,
      },
      null
    );
    res.set("Content-Type", "application/json");
    res.send(formattedData);
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.get("/states/:state/nickname", cors(), async (req, res) => {
  const stateCode = req.params.state.toUpperCase();
  let state = await statesDataIncludeFunFacts.find(
    (state) => state.code === stateCode
  );

  if (state) {
    const formattedData = JSON.stringify(
      {
        state: state.state,
        nickname: state.nickname,
      },
      null
    );
    res.set("Content-Type", "application/json");
    res.send(formattedData);
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.get("/states/:state/population", cors(), async (req, res) => {
  const stateCode = req.params.state.toUpperCase();
  let state = await statesDataIncludeFunFacts.find(
    (state) => state.code === stateCode
  );

  if (state) {
    const formattedData = JSON.stringify(
      {
        state: state.state,
        population: state.population.toLocaleString(),
      },
      null
    );
    res.set("Content-Type", "application/json");
    res.send(formattedData);
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.get("/states/:state/admission", async (req, res) => {
  const stateCode = req.params.state.toUpperCase();
  let state = await statesDataIncludeFunFacts.find(
    (state) => state.code === stateCode
  );

  if (state) {
    const formattedData = JSON.stringify(
      {
        state: state.state,
        admitted: state.admission_date,
      },
      null
    );
    res.set("Content-Type", "application/json");
    res.send(formattedData);
  } else {
    res.status(404).json({ message: "Invalid state abbreviation parameter" });
  }
});

app.get("*", cors(), (req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

async function connectToDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
  } catch (err) {
    console.error(err);
  }
}

app.listen(3500);
