// server.js
const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
const port = 3005;

// PostgreSQL database connection configuration
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: '1234',
    port: 5432,
});

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Create tables if not exists and insert initial values
pool.query(`
    CREATE TABLE IF NOT EXISTS language (
        language_id SERIAL PRIMARY KEY,
        language_name VARCHAR(50) UNIQUE
    );
    CREATE TABLE IF NOT EXISTS question (
        question_id SERIAL PRIMARY KEY,
        language_id INT,
        question_text VARCHAR(255),
        FOREIGN KEY (language_id) REFERENCES language(language_id)
    );
    CREATE TABLE IF NOT EXISTS option (
        option_id SERIAL PRIMARY KEY,
        question_id INT,
        option_text VARCHAR(255),
        FOREIGN KEY (question_id) REFERENCES question(question_id)
    );
    CREATE TABLE IF NOT EXISTS response (
        response_id SERIAL PRIMARY KEY,
        language_id INT
    );
    CREATE TABLE IF NOT EXISTS response_details (
        id SERIAL PRIMARY KEY,
        question_id INT,
        option_id INT,
        response_id INT,
        FOREIGN KEY (question_id) REFERENCES question(question_id),
        FOREIGN KEY (option_id) REFERENCES option(option_id),
        FOREIGN KEY (response_id) REFERENCES response(response_id)
    );
    INSERT INTO language (language_name) VALUES 
        ('Java'),
        ('Python'),
        ('C++'),
        ('JavaScript');
    -- Insert questions for Java
    INSERT INTO question (language_id, question_text) VALUES
        (1, 'What is polymorphism in Java?'),
        (1, 'Explain the difference between abstract class and interface in Java.');

    -- Insert questions for Python
    INSERT INTO question (language_id, question_text) VALUES
        (2, 'What are tuples in Python?'),
        (2, 'What is the difference between list and tuple in Python?');

    -- Insert questions for C++
    INSERT INTO question (language_id, question_text) VALUES
        (3, 'What is the purpose of a constructor in C++?'),
        (3, 'Explain the concept of inheritance in C++.');

    -- Insert questions for JavaScript
    INSERT INTO question (language_id, question_text) VALUES
        (4, 'What is event delegation in JavaScript?'),
        (4, 'Explain the concept of closures in JavaScript.');

    -- Insert options for Java questions
    INSERT INTO option (question_id, option_text) VALUES
        (1, 'Polymorphism in Java allows methods to do different things based on their parameters.'),
        (1, 'Polymorphism in Java allows a subclass to provide a specific implementation of a method that is already provided by its superclass.');

    INSERT INTO option (question_id, option_text) VALUES
        (2, 'An abstract class in Java cannot be instantiated, while an interface can be instantiated.'),
        (2, 'An abstract class in Java can have both abstract and concrete methods, while an interface can only have abstract methods.');

    -- Insert options for Python questions
    INSERT INTO option (question_id, option_text) VALUES
        (3, 'Tuples in Python are immutable sequences, typically used to store collections of heterogeneous data.'),
        (3, 'Tuples in Python are similar to lists, but they are immutable.');

    INSERT INTO option (question_id, option_text) VALUES
        (4, 'A list is mutable, while a tuple is immutable in Python.'),
        (4, 'A list uses square brackets [], while a tuple uses parentheses ().');

    -- Insert options for C++ questions
    INSERT INTO option (question_id, option_text) VALUES
        (5, 'A constructor in C++ is a special member function of a class that is executed whenever a new object of that class is created.'),
        (5, 'A constructor in C++ is used to initialize the data members of a class.');

    INSERT INTO option (question_id, option_text) VALUES
        (6, 'Inheritance in C++ allows a class to inherit properties and behavior from another class.'),
        (6, 'Inheritance in C++ facilitates code reusability by allowing a class to use the functionality of another class.');

    -- Insert options for JavaScript questions
    INSERT INTO option (question_id, option_text) VALUES
        (7, 'Event delegation is a technique for handling events where you delegate the responsibility of handling events to a common ancestor element.'),
        (7, 'Event delegation in JavaScript improves performance by reducing the number of event listeners.');

    INSERT INTO option (question_id, option_text) VALUES
        (8, 'Closures in JavaScript allow functions to retain access to variables from their containing lexical scope even after the parent function has finished executing.'),
        (8, 'Closures in JavaScript are commonly used to create private variables and functions.');
`, (error, results) => {
    if (error) {
        console.error('Error creating tables and inserting initial values:', error);
    } else {
        console.log('Tables created and initial values inserted successfully');
    }
});

// Route to fetch programming languages
app.get('/languages', (req, res) => {
    pool.query('SELECT * FROM language', (error, results) => {
        if (error) {
            console.error('Error fetching languages:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        res.json(results.rows);
    });
});

// Route to fetch questions for a specific language
app.get('/questions/:languageId', (req, res) => {
    const languageId = req.params.languageId;
    pool.query('SELECT * FROM question WHERE language_id = $1', [languageId], (error, results) => {
        if (error) {
            console.error('Error fetching questions:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        const questions = results.rows;
        const questionIds = questions.map(question => question.question_id);
        // Fetch options for each question
        fetchOptions(questionIds)
            .then(optionsMap => {
                questions.forEach(question => {
                    question.options = optionsMap[question.question_id];
                });
                res.json(questions);
            })
            .catch(err => {
                console.error('Error fetching options:', err);
                res.status(500).json({ error: 'Internal server error' });
            });
    });
});

// Function to fetch options for questions
async function fetchOptions(questionIds) {
    const optionsMap = {};
    for (const questionId of questionIds) {
        const options = await pool.query('SELECT * FROM option WHERE question_id = $1', [questionId]);
        optionsMap[questionId] = options.rows;
    }
    return optionsMap;
}

// Route to handle form submissions
app.post('/submit-response', (req, res) => {
    const { languageId, responses } = req.body;

    // Insert response into database
    pool.query('INSERT INTO response (language_id) VALUES ($1) RETURNING response_id', [languageId], (error, result) => {
        if (error) {
            console.error('Error inserting response:', error);
            res.status(500).json({ error: 'Internal server error' });
            return;
        }
        const responseId = result.rows[0].response_id;
        // Insert individual responses into database
        const values = responses.map(response => `( ${response.questionId}, ${response.optionId}, ${responseId})`).join(',');
        pool.query(`INSERT INTO response_details ( question_id, option_id, response_id) VALUES ${values}`, (error) => {
            if (error) {
                console.error('Error inserting response details:', error);
                res.status(500).json({ error: 'Internal server error' });
                return;
            }
            res.status(200).json({ message: 'Response submitted successfully' });
        });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
