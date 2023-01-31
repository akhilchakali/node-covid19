const express = require("express");
const { open } = require("sqlite");
const path = require("path");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () =>
      console.log("Server running at http://localhost:3000")
    );
  } catch (error) {
    console.log(`db error ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUser = `
    SELECT
    *
    FROM 
    user
    WHERE
    username = '${username}';`;
  const returnedUser = await db.get(getUser);

  if (returnedUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const matchPassword = await bcrypt.compare(password, returnedUser.password);
    if (matchPassword !== true) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      jwtToken = jwt.sign(payload, "akhil");
      response.send({ jwtToken });
    }
  }
});

const authenticate = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "akhil", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertDbObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

app.get("/states/", authenticate, async (request, response) => {
  const getStates = `
    SELECT
    *
    FROM
    state`;
  const returnedStates = await db.all(getStates);
  response.send(returnedStates.map((each) => convertDbObject(each)));
});

app.get("/states/:stateId/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const getState = `
  SELECT
  *
  FROM
  state
  WHERE
  state_id = '${stateId}';`;
  const returnedState = await db.get(getState);
  response.send({
    stateId: returnedState["state_id"],
    stateName: returnedState["state_name"],
    population: returnedState["population"],
  });
});

app.post("/districts/", authenticate, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const addDistrict = `
  INSERT INTO district(district_name, state_id, cases, cured, active, deaths)
  VALUES('${districtName}', '${stateId}', '${cases}', '${cured}', '${active}', '${deaths}');`;
  addedDistrict = await db.run(addDistrict);
  response.send("District Successfully Added");
});

app.get("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const getDistrict = `
    SELECT
    *
    FROM 
    district
    WHERE district_id = '${districtId}';`;
  const returnedDistrict = await db.get(getDistrict);
  response.send({
    districtId: returnedDistrict["district_id"],
    districtName: returnedDistrict["district_name"],
    stateId: returnedDistrict["state_id"],
    cases: returnedDistrict["cases"],
    cured: returnedDistrict["cured"],
    active: returnedDistrict["active"],
    deaths: returnedDistrict["deaths"],
  });
});

app.delete(
  "/districts/:districtId/",
  authenticate,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrict = `
    DELETE FROM district
    WHERE district_id = '${districtId}';`;
    const deletedDistrict = await db.run(deleteDistrict);
    response.send("District Removed");
  }
);

app.put("/districts/:districtId/", authenticate, async (request, response) => {
  const { districtId } = request.params;
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const updateDistrict = `
  UPDATE district
  SET
  district_name = '${districtName}',
  state_id = '${stateId}',
  cases = '${cases}',
  cured = '${cured}',
  active = '${active}',
  deaths = '${deaths}'
  WHERE 
  district_id = '${districtId}';`;
  const updatedDistrict = await db.run(updateDistrict);
  response.send("District Details Updated");
});

app.get("/states/:stateId/stats/", authenticate, async (request, response) => {
  const { stateId } = request.params;
  const stats = `
    SELECT
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    FROM
    state NATURAL JOIN district
    WHERE
    state_id = '${stateId}';`;
  const statsR = await db.get(stats);
  response.send({
    totalCases: statsR["SUM(cases)"],
    totalCured: statsR["SUM(cured)"],
    totalActive: statsR["SUM(active)"],
    totalDeaths: statsR["SUM(deaths)"],
  });
});

module.exports = app;
