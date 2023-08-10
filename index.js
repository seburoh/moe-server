const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2');

// const port = 3001; // Replace this with your desired port number
const port = process.env.PORT || 3001;

// Configure static file serving for the "public" folder
app.use(express.static('public'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Database connection
const db = mysql.createPool({
    //Remote DB
    // host: 'us-cdbr-east-06.cleardb.net',
    // user: 'bbc1d236a2fdf8',
    // password: 'c0f12074',
    // database: 'heroku_7dd2ee314208c5d',
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_BASE,

    //Local DB
    // host: 'localhost',  // Change to localhost
    // port: 3306,         // Specify the port
    // user: 'root',       // Use the root user
    // password: 'PW',  // Use the specified password
    // database: 'pokesand', // Replace if needed

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

/*
 * Return HTML for the / end point.
 * This is a nice location to document your web service API
 * Create a web page in HTML/CSS and have this end point return it.
 * Look up the node module 'fs' ex: require('fs');
 */
app.get("/", (request, response) => {
    //this is a Web page so set the content-type to HTML
    response.writeHead(200, { "Content-Type": "text/html" });
    for (i = 1; i < 7; i++) {
        //write a response to the client
        response.write("<h" + i + ' style="color:#5FE88D">moe moe kyun</h' + i + ">");
    }
    response.end(); //end the response
});

/**
 * Endpoint test for basic text results of stored pokemon data.
 * Example URL: http://localhost:3001/pokes
 */
app.get("/pokes", (req, res) => {
    const testQuery = `
        SELECT *,
            (SELECT pr.name FROM pokemon_ref pr WHERE pr.national_id = er.evolves_from) AS evolves_from_name
        FROM pokemon_ref p
        NATURAL JOIN pokemon_type
        JOIN evolve_ref er ON p.national_id = er.national_id
    `;

    db.query(testQuery, (err, result) => {
        if (err) {
            console.error("Error retrieving Pokemon data:", err);
            res.status(500).send("Error retrieving Pokemon data");
            return;
        }
        const pokemonInfoList = result.map(pokemon => {
            let pokemonInfo = `Name: ${pokemon.name}
                |ID: ${pokemon.national_id}
                |Primary Type: ${pokemon.primary_type}
                |Secondary Type: ${pokemon.secondary_type || 'None'}`;
            if (pokemon.evolves_from !== null) {
                pokemonInfo += `\n|Evolves From: ${pokemon.evolves_from_name}`;
            }
            return pokemonInfo + "\n--------------------";
        });
        res.send(pokemonInfoList.join('\n'));
    });
});

/**
 * Endpoint for retrieving all pokemon basic details.
 * Example URL: http://localhost:3001/pokes3
 */
app.get("/pokes3", (req, res) => {
    const theQuery = `
        SELECT pr.name, pr.national_id, pp.icon_1, pc.caught
        from pokemon_ref pr
        join pokemon_pics pp on pr.national_id = pp.national_id
        join pokemon_caught pc on pp.national_id = pc.national_id`;
    db.query(theQuery, (err, result) => {
        if (err) {
            console.error("Error retrieving image:", err);
            res.status(500).send("Error retrieving image");
            return;
        }
        if (result.length === 0) {
            res.status(404).send("Valid pokes not found");
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ poke: result });
    });
});

/**
 * Allows for getting a specific pokemon's name, sprite, icon, 
 * base stats, location, abilities, rates, and type(s).
 * Example URL: http://localhost:3001/pokeName/255
 */
app.get("/pokeData/:national_id", (req, res) => {
    const theQuery = `
    SELECT *,
        (select description from ability_list a1 where a1.name = pa.ability_1) as ability_1_desc,
        (select description from ability_list a2 where a2.name = pa.ability_2) as ability_2_desc,
        (select description from ability_list ah where ah.name = pa.hidden_ability) as ability_h_desc
    FROM pokemon_ref
    JOIN pokemon_type pt ON pokemon_ref.national_id = pt.national_id
    JOIN base_stats bs ON pokemon_ref.national_id = bs.ID
    JOIN other_ref o ON pokemon_ref.national_id = o.national_id
    JOIN pokemon_abilities pa ON pokemon_ref.national_id = pa.national_id
    JOIN pokemon_location pl ON pokemon_ref.national_id = pl.national_id
    JOIN pokemon_pics pp ON pokemon_ref.national_id = pp.national_id
    WHERE pokemon_ref.national_id = ?
    `;

    const values = [req.params.national_id];
    db.query(theQuery, values, (err, rows) => {
        if (err) {
            console.error("Error retrieving data:", err);
            res.status(500).send("Error retrieving data");
            return;
        }
        if (rows.length !== 1) {
            res.status(404).send("Valid pokes not found");
        } else {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).json(rows[0]);
        }
    });
});

/**
 * Endpoint for retrieving party pokemon.
 * Example URL: http://localhost:3001/party
 */
app.get("/party", (req, res) => {
    const theQuery = `
        select pa.slot, pp.sprite
        from pokemon_party pa
        join pokemon_pics pp on pa.id = pp.national_id`;
    db.query(theQuery, (err, result) => {
        if (err) {
            console.error("Error retrieving image:", err);
            res.status(500).send("Error retrieving image");
            return;
        }
        if (result.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).json({ message: 'empty party' });
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ poke: result });
    });
});

/**
 * Endpoint for setting party pokemon.
 * Example URL: http://localhost:3001/party
 */
app.post("/party", (req, res) => {
    const slot = req.body.slot; // Assuming the slot value is provided in the request body
    const ID = req.body.ID;     // Assuming the ID value is provided in the request body

    if (typeof slot !== 'number' || typeof ID !== 'number' || slot < 1 || slot > 6) {
        res.status(400).send("Invalid slot or ID values");
        return;
    }

    var theQuery = `
        INSERT INTO pokemon_party (slot, ID)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE ID = VALUES(ID);
    `;

    if (ID === -1) {
        theQuery = `
        DELETE FROM pokemon_party WHERE slot = ?;
    `;
    }

    db.query(theQuery, [slot, ID], (err, result) => {
        if (err) {
            console.error("Error executing query:", err);
            res.status(500).send("Error executing query");
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ message: "success" });
    });
});

/**
 * Endpoint for setting caught pokemon.
 * Example URL: http://localhost:3001/caught
 */
app.post("/caught", (req, res) => {
    const ID = req.body.ID;     // Assuming the ID value is provided in the request body

    const theQuery = `
        update pokemon_caught
        SET caught = not caught
        WHERE national_id = ?;
    `;
    db.query(theQuery, [ID], (err, result) => {
        if (err) {
            console.error("Error executing query:", err);
            res.status(500).send("Error executing query");
            return;
        }

        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ message: "Caught pokemon updated successfully" });
    });
});

/**
 * Endpoint for retrieving party pokemon.
 * Example URL: http://localhost:3001/party
 */
app.get("/evolvesinto/:national_id", (req, res) => {
    const values = [req.params.national_id];
    const theQuery = `
        select pf.name, pp.sprite, er.evolve_method
        from evolve_ref er
        join pokemon_pics pp using (national_id)
        join pokemon_ref pf using (national_id)
        where er.evolves_from = ?`;
    db.query(theQuery, values, (err, result) => {
        if (err) {
            console.error("Error retrieving stuff:", err);
            res.status(500).send("Error retrieving stuff");
            return;
        }
        if (result.length === 0) {
            res.setHeader('Content-Type', 'application/json');
            res.status(200).json({ message: 'no evolutions' });
            return;
        }
        res.setHeader('Content-Type', 'application/json');
        res.status(200).json({ poke: result });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
