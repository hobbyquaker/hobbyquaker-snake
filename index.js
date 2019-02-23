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
let directionHistory = [];
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


        let possible = new Set(['up', 'down', 'left', 'right']);

        switch (direction) {
            case 'up':
                possible.delete('down');
                break;
            case 'down':
                possible.delete('up');
                break;
            case 'left':
                possible.delete('right');
                break;
            case 'right':
                possible.delete('left');
                break;

        }

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

        if (!possible.has(direction)) return s;

        //console.log('nextPossible', direction, r, possible, nextX, nextY);

        if (r > 2) return s;
        let dirs = new Set(['up', 'down', 'left', 'right']);
        switch (direction) {
            case 'up':
                dirs.delete('down');
                break;
            case 'down':
                dirs.delete('up');
                break;
            case 'left':
                dirs.delete('right');
                break;
            case 'right':
                dirs.delete('left');
                break;

        }
        dirs.forEach(nextDirection => {
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
            if (i === snake.body.length - 1) return;
            board[c.x][c.y] = 0;
            if (x === c.x && y === (c.y + 1)) {
                possible.delete('up');
            }
            if (x === c.x && y === (c.y - 1)) {
                possible.delete('down');
            }
            if (y === c.y && x === (c.x + 1)) {
                possible.delete('left');
            }
            if (y === c.y && x === (c.x - 1)) {
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
        if (score[direction] < (maxScore / 10)) {
            possible.delete(direction);
        }
    });

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

    let dx = Math.abs(c.x - x);
    let dy = Math.abs(c.y - y);


    if (directionHistory[2] === 'left' && directionHistory[1] === 'up' && directionHistory[0] === 'right') {
        possible.delete('down');
    }
    if (directionHistory[2] === 'left' && directionHistory[1] === 'down' && directionHistory[0] === 'right') {
        possible.delete('up');
    }
    if (directionHistory[2] === 'up' && directionHistory[1] === 'right' && directionHistory[0] === 'down') {
        possible.delete('left');
    }
    if (directionHistory[2] === 'up' && directionHistory[1] === 'left' && directionHistory[0] === 'down') {
        possible.delete('right');
    }

    let move;

    if (c.x === x && c.y < y && possible.has('up')) {
        move = 'up';
    } else if (c.x === x && c.y > y && possible.has('down')) {
        move = 'down';
    } else if (c.y === y && c.x > x && possible.has('right')) {
        move = 'right';
    } else if (c.y === y && c.x < x && possible.has('left')) {
        move = 'left';
    } else if (dy <= dx && c.y < y && possible.has('up')) {
        move = 'up';
    } else if (dy <= dx && c.y > y && possible.has('down')) {
        move = 'down';
    } else if (dx < dy && c.x < x && possible.has('left')) {
        move = 'left';
    } else if (dx < dy && c.x > x && possible.has('right')) {
        move = 'right';
    } else if (possible.has(lastMove)) {
        move = lastMove;
    } else {
        const arrPossible = Array.from(possible);
        move = arrPossible[Math.floor(Math.random() * arrPossible.length)];
    }


    lastMove = move;

    if (directionHistory[directionHistory.length - 1] !== move) {
        directionHistory.push(move);
        if (directionHistory.length > 3) {
            directionHistory.shift();
        }
    }

    console.log('->', move, directionHistory);
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
