const bodyParser = require('body-parser')
const express = require('express')
const logger = require('morgan')
const app = express()
const {
  fallbackHandler,
  notFoundHandler,
  genericErrorHandler,
  poweredByHandler
} = require('./handlers.js')

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001))

app.enable('verbose errors')

//app.use(logger('dev'))
app.use(bodyParser.json())
app.use(poweredByHandler)

// --- SNAKE LOGIC GOES BELOW THIS LINE ---


let height;
let width;


app.post('/start', (request, response) => {

    height = request.body.board.height;
    width = request.body.board.width;

    console.log('Start', width, height);

    const data = {
        color: '#DFFF00',
    };

    return response.json(data)
});

let lastMove;

app.post('/move', (request, response) => {


    const {x, y} = request.body.you.body[0];
    console.log(request.body.turn, request.body.you.body);

    const possible = new Set(['up', 'down', 'left', 'right']);

    if (x === 0) possible.delete('left');
    if (x === (width - 1)) possible.delete('right');
    if (y === 0) possible.delete('up');
    if (y === (height - 1)) possible.delete('down');

    request.body.you.body.forEach(coord => {
        if (x === coord.x && y === (coord.y + 1)) {
            possible.delete('up');
        }
        if (x === coord.x && y === (coord.y - 1)) {
            possible.delete('down');
        }
        if (y === coord.y && x === (coord.x + 1)) {
            possible.delete('left');
        }
        if (y === coord.y && x === (coord.x - 1)) {
            possible.delete('right');
        }
    });

    console.log('possible', possible);

    let nearest = 0;
    let nearestDist = width + height + 1;

    request.body.board.food.forEach((coord, index) => {
        let dist = Math.abs(coord.x - x) + Math.abs(coord.y - y);
        if (dist < nearestDist) {
            nearest = index;
        }
    });

    const food = request.body.board.food[nearest];
    console.log('food', food);

    let move;

    if (food.x === x && food.y < y && possible.has('up')) {
        move = 'up';
    } else if (food.x === x && food.y > y && possible.has('down')) {
        move = 'down';
    } else if (food.y === y && food.x > x && possible.has('right')) {
        move = 'right';
    } else if (food.y === y && food.x < x && possible.has('left')) {
        move = 'left';
    } else if (possible.has(lastMove)) {
        move = lastMove;
    } else {
        const arrPossible = Array.from(possible);
        move = arrPossible[Math.floor(Math.random() * arrPossible.length)];
    }

    lastMove = move;
    const data = {move};

    return response.json(data)
});

app.post('/end', (request, response) => {
  // NOTE: Any cleanup when a game is complete.
  return response.json({})
})

app.post('/ping', (request, response) => {
  // Used for checking if this snake is still alive.
  return response.json({});
})

// --- SNAKE LOGIC GOES ABOVE THIS LINE ---

app.use('*', fallbackHandler)
app.use(notFoundHandler)
app.use(genericErrorHandler)

app.listen(app.get('port'), () => {
  console.log('Server listening on port %s', app.get('port'))
})
