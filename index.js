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

let lastMove;
let board = [];

app.post('/start', (request, response) => {

    height = request.body.board.height;
    width = request.body.board.width;

    console.log('Start', width, height);


    for (let x = 0; x < width; x++) {
        board[x] = [];
        for (let y = 0; y < height; y++) {
            board[x][y] = 100;
        }
    }

    const data = {
        color: '#DFFF00',
    };

    return response.json(data)
});



function calculateScore(direction, x, y, r = 0) {
    let s = 0;
    let nextX = x;
    let nextY = y;

    switch (direction) {
        case 'right':
            nextX += 1;
            break;
        case 'left':
            nextX -= 1;
            break;
        case 'up':
            nextY -= 1;
            break;
        case 'down':
            nextY += 1;
            break;
        default:

    }
    if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
        s += (board[nextX] && board[nextX][nextY] || 0);

        return s;

        let possible = new Set(['up', 'down', 'left', 'right']);

        if (nextX === 0) {
            possible.delete('left');
        } else if (board[nextX - 1][nextY] < 100) {
            possible.delete('left');
        }

        if (nextX === (width - 1)) {
            possible.delete('right');
        } else if (board[nextX + 1][nextY] < 100) {
            possible.delete('right');
        }

        if (nextY === 0) {
            possible.delete('up');
        } else if (board[nextX][nextY - 1] < 100) {
            possible.delete('up');
        }

        if (nextY === (height - 1)) {
            possible.delete('down');
        } else if (board[nextX][nextY + 1] < 100) {
            possible.delete('down');
        }

        console.log('nextPossible', possible);

        possible.forEach(nextDirection => {
            s += calculateScore(nextDirection, nextX, nextY, r + 1);
        });
    }

    return s;
}


app.post('/move', (request, response) => {


    const {x, y} = request.body.you.body[0];
    console.log(request.body.turn, request.body.you.body[0]);

    let possible = new Set(['up', 'down', 'left', 'right']);

    if (x === 0) possible.delete('left');
    if (x === (width - 1)) possible.delete('right');
    if (y === 0) possible.delete('up');
    if (y === (height - 1)) possible.delete('down');


    for (let vx = 0; vx < width; vx++) {
        for (let vy = 0; vy < height; vy++) {
            board[vx][vy] = 100;
        }
    }

    request.body.board.snakes.forEach(snake => {
        snake.body.forEach((c, i) => {
            board[c.x][c.y] = 0;
            if (x === c.x && (y === (c.y + 1) || y === (c.y + 2))) {
                possible.delete('up');
            }
            if (x === c.x && (y === (c.y - 1) || y === (c.y - 2))) {
                possible.delete('down');
            }
            if (y === c.y && (x === (c.x + 1) || x === (c.x + 2))) {
                possible.delete('left');
            }
            if (y === c.y && (x === (c.x - 1) || x === (c.x - 2))) {
                possible.delete('right');
            }
        });
    });

    board[x][y] = 1;

    for (let vy = 0; vy < height; vy++) {
        let line = '';
        for (let vx = 0; vx < width; vx++) {
            switch (board[vx][vy]) {
                case 100:
                    line += ' . ';
                    break;
                case 1:
                    line += ' o ';
                    break;
                default:
                    line += ' * ';
            }
        }
        console.log(line);
    }

    /*
    let score = {
        up: 0,
        down: 0,
        left: 0,
        right: 0
    };
    possible.forEach(direction => {
        score[direction] = calculateScore(direction, x, y);
    });

    console.log(score);

    let maxScore = 0;
    possible.forEach(direction => {
        if (score[direction] > maxScore) {
            maxScore = score[direction];
        }
    });
    possible.forEach(direction => {
        if (score[direction] < maxScore) {
            possible.delete(direction);
        }
    });
*/
    console.log('possible', possible);

    let nearest = 0;
    let nearestDist = width + height + 1;

    request.body.board.food.forEach((c, i) => {
        let dist = Math.abs(c.x - x) + Math.abs(c.y - y);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = i;
        }
    });

    const c = request.body.board.food[nearest] || {};
    console.log('food', c.x, c.y);

    let move;

    if (c.x === x && c.y < y && possible.has('up')) {
        move = 'up';
    } else if (c.x === x && c.y > y && possible.has('down')) {
        move = 'down';
    } else if (c.y === y && c.x > x && possible.has('right')) {
        move = 'right';
    } else if (c.y === y && c.x < x && possible.has('left')) {
        move = 'left';
    } else if (possible.has(lastMove)) {
        move = lastMove;
    } else {
        const arrPossible = Array.from(possible);
        move = arrPossible[Math.floor(Math.random() * arrPossible.length)];
    }

    lastMove = move;
    console.log('->', move);
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
