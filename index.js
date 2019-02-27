const bodyParser = require('body-parser');
const express = require('express');
const logger = require('morgan');

const app = express();
const {
    fallbackHandler,
    notFoundHandler,
    genericErrorHandler,
    poweredByHandler
} = require('./handlers.js');

// For deployment to Heroku, the port needs to be set using ENV, so
// we check for the port number in process.env
app.set('port', (process.env.PORT || 9001));

app.enable('verbose errors');

// App.use(logger('dev'))
app.use(bodyParser.json());
app.use(poweredByHandler);

const state = {};

app.post('/end', (request, response) => {
    delete state[request.body.game.id];
    return response.json({});
});

app.post('/start', (request, response) => {
    const game = request.body.game.id;
    const {height} = request.body.board;
    const {width} = request.body.board;

    state[game] = {
        width,
        height,
        directionHistory: [],
        board: [],
        sameDirectionTurns: 0,
        lastMove: null
    };

    console.log('Start', width, height);

    for (let x = 0; x < width; x++) {
        state[game].board[x] = [];
        for (let y = 0; y < height; y++) {
            state[game].board[x][y] = 100;
        }
    }

    const data = {
        color: '#DFFF00'
    };

    return response.json(data);
});

function calculateScore(game, direction, x, y, r = 0) {
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

    if (nextX >= 0 && nextX < state[game].width && nextY >= 0 && nextY < state[game].height) {
        s += (state[game].board[nextX] && state[game].board[nextX][nextY] || 0);

        const possible = new Set(['up', 'down', 'left', 'right']);

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
        } else if (state[game].board[nextX - 1][nextY] < 100) {
            possible.delete('left');
        }

        if (nextX === (state[game].width - 1)) {
            possible.delete('right');
        } else if (state[game].board[nextX + 1][nextY] < 100) {
            possible.delete('right');
        }

        if (nextY === 0) {
            possible.delete('up');
        } else if (state[game].board[nextX][nextY - 1] < 100) {
            possible.delete('up');
        }

        if (nextY === (state[game].height - 1)) {
            possible.delete('down');
        } else if (state[game].board[nextX][nextY + 1] < 100) {
            possible.delete('down');
        }

        if (!possible.has(direction)) {
            return s;
        }

        // Console.log('nextPossible', direction, r, possible, nextX, nextY);

        if (r > 3) {
            return s;
        }

        const dirs = new Set(['up', 'down', 'left', 'right']);
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
            default:
        }

        dirs.forEach(nextDirection => {
            s += calculateScore(game, nextDirection, nextX, nextY, r + 1);
        });
    }

    return s;
}

app.post('/move', (request, response) => {
    const game = request.body.game.id;

    const {x, y} = request.body.you.body[0];
    const myLength = request.body.you.body.length;
    const {health} = request.body.you;
    console.log(request.body.turn, request.body.you.body[0]);

    const possible = new Set(['up', 'down', 'left', 'right']);

    if (x === 0) {
        possible.delete('left');
    }

    if (x === (state[game].width - 1)) {
        possible.delete('right');
    }

    if (y === 0) {
        possible.delete('up');
    }

    if (y === (state[game].height - 1)) {
        possible.delete('down');
    }

    for (let vx = 0; vx < state[game].width; vx++) {
        for (let vy = 0; vy < state[game].height; vy++) {
            state[game].board[vx][vy] = 100;
        }
    }

    request.body.board.snakes.forEach(snake => {
        snake.body.forEach((c, i) => {
            if (i === (snake.body.length - 1)) {
                return;
            }

            if (i === 0 && snake.id !== request.body.you.id) {
                const enemyLength = snake.body.length;
                if (myLength < enemyLength) {
                    if (c.x > 0) {
                        state[game].board[c.x - 1][c.y] = 0;
                    } else if (c.x < (state[game].width - 1)) {
                        state[game].board[c.x + 1][c.y] = 0;
                    }

                    if (c.y > 0) {
                        state[game].board[c.x][c.y - 1] = 0;
                    } else if (c.y < (state[game].height - 1)) {
                        state[game].board[c.x][c.y + 1] = 0;
                    }
                }
            }

            state[game].board[c.x][c.y] = 0;
            if (state[game].board[x][y - 1] === 0) {
                possible.delete('up');
            }

            if (state[game].board[x][y + 1] === 0) {
                possible.delete('down');
            }

            if (state[game].board[x - 1][y] === 0) {
                possible.delete('left');
            }

            if (state[game].board[x + 1][y] === 0) {
                possible.delete('right');
            }
        });
    });

    state[game].board[x][y] = 1;

    for (let vy = 0; vy < state[game].height; vy++) {
        let line = '';
        for (let vx = 0; vx < state[game].width; vx++) {
            switch (state[game].board[vx][vy]) {
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

    const score = {
        up: 0,
        down: 0,
        left: 0,
        right: 0
    };
    possible.forEach(direction => {
        score[direction] = calculateScore(game, direction, x, y);
    });

    console.log(score);

    let maxScore = 0;
    possible.forEach(direction => {
        if (score[direction] > maxScore) {
            maxScore = score[direction];
        }
    });
    /*
    Possible.forEach(direction => {
        if (score[direction] < (maxScore / 10)) {
            possible.delete(direction);
        }
    });
    */

    console.log('possible', possible);

    let nearest = 0;
    let nearestDist = state[game].width + state[game].height + 1;

    request.body.board.food.forEach((c, i) => {
        const dist = Math.abs(c.x - x) + Math.abs(c.y - y);
        if (dist < nearestDist) {
            nearestDist = dist;
            nearest = i;
        }
    });

    const c = request.body.board.food[nearest] || {};
    console.log('food', c.x, c.y);

    const dx = Math.abs(c.x - x);
    const dy = Math.abs(c.y - y);

    console.log('history', state[game].directionHistory, state[game].sameDirectionTurns);

    if (possible.size > 1 && state[game].sameDirectionTurns < 6) {
        if (/* state[game].directionHistory[3] === 'down' && */ state[game].directionHistory[0] === 'left' && state[game].directionHistory[1] === 'up' && state[game].directionHistory[2] === 'right') {
            possible.delete('down');
        }

        if (/* state[game].directionHistory[3] === 'up' && */ state[game].directionHistory[0] === 'left' && state[game].directionHistory[1] === 'down' && state[game].directionHistory[2] === 'right') {
            possible.delete('up');
        }

        if (/* state[game].directionHistory[3] === 'down' && */ state[game].directionHistory[0] === 'right' && state[game].directionHistory[1] === 'up' && state[game].directionHistory[2] === 'left') {
            possible.delete('down');
        }

        if (/* state[game].directionHistory[3] === 'up' && */ state[game].directionHistory[0] === 'right' && state[game].directionHistory[1] === 'down' && state[game].directionHistory[2] === 'left') {
            possible.delete('up');
        }

        if (/* state[game].directionHistory[3] === 'left' && */ state[game].directionHistory[0] === 'up' && state[game].directionHistory[1] === 'right' && state[game].directionHistory[2] === 'down') {
            possible.delete('left');
        }

        if (/* state[game].directionHistory[3] === 'right' && */ state[game].directionHistory[0] === 'up' && state[game].directionHistory[1] === 'left' && state[game].directionHistory[2] === 'down') {
            possible.delete('right');
        }

        if (/* state[game].directionHistory[3] === 'left' && */ state[game].directionHistory[0] === 'down' && state[game].directionHistory[1] === 'right' && state[game].directionHistory[2] === 'up') {
            possible.delete('left');
        }

        if (/* state[game].directionHistory[3] === 'right' && */ state[game].directionHistory[0] === 'down' && state[game].directionHistory[1] === 'left' && state[game].directionHistory[2] === 'up') {
            possible.delete('right');
        }
    }

    console.log('possible after circle prevention', possible);

    if (possible.size > 1 && health > 50) {
        if ((state[game].width - x) < 4) {
            possible.delete('right');
        } else if (x < 3) {
            possible.delete('left');
        }
    }

    if (possible.size > 1 && health > 50) {
        if ((state[game].height - y) < 4) {
            possible.delete('down');
        } else if (y < 3) {
            possible.delete('up');
        }
    }

    console.log('possible after nearwall prevention', possible);

    let move;

    const healthMaxDirect = 80;
    const healthMax = 90;

    if (health < healthMaxDirect && c.x === x && c.y < y && possible.has('up')) {
        move = 'up';
        console.log('food direct', move);
    } else if (health < healthMaxDirect && c.x === x && c.y > y && possible.has('down')) {
        move = 'down';
        console.log('food direct', move);
    } else if (health < healthMaxDirect && c.y === y && c.x > x && possible.has('right')) {
        move = 'right';
        console.log('food direct', move);
    } else if (health < healthMaxDirect && c.y === y && c.x < x && possible.has('left')) {
        move = 'left';
        console.log('food direct', move);
    } else if (health < healthMax && dy <= dx && c.y < y && possible.has('up')) {
        move = 'up';
        console.log('food', move);
    } else if (health < healthMax && dy <= dx && c.y > y && possible.has('down')) {
        move = 'down';
        console.log('food', move);
    } else if (health < healthMax && dx < dy && c.x < x && possible.has('left')) {
        move = 'left';
        console.log('food', move);
    } else if (health < healthMax && dx < dy && c.x > x && possible.has('right')) {
        move = 'right';
        console.log('food', move);
    } else if (possible.has(state[game].lastMove)) {
        move = state[game].lastMove;
    } else if (possible.size === 1) {
        move = [...possible][0];
        console.log('only 1 possibility left', move);
    } else {
        if (possible.size === 0) {
            if (x > 0 && state[game].board[x - 1][y]) {
                possible.add('left');
            }

            if (x < (state[game].width - 1) && state[game].board[x + 1][y]) {
                possible.add('right');
            }

            if (y > 0 && state[game].board[x][y - 1]) {
                possible.add('up');
            }

            if (y < (state[game].height - 1) && state[game].board[x][y + 1]) {
                possible.add('down');
            }
        }

        possible.forEach(d => {
            if (score[d] < (maxScore / 1.05)) {
                possible.delete(d);
            }
        });

        console.log('random', possible);
        const arrPossible = [...possible];
        move = arrPossible[Math.floor(Math.random() * arrPossible.length)];
    }

    state[game].lastMove = move;

    if (state[game].directionHistory[state[game].directionHistory.length - 1] === move) {
        state[game].sameDirectionTurns += 1;
    } else {
        state[game].directionHistory.push(move);
        if (state[game].directionHistory.length > 3) {
            state[game].directionHistory.shift();
        }

        state[game].sameDirectionTurns = 0;
    }

    console.log('->', move);
    const data = {move};

    return response.json(data);
});


app.post('/ping', (request, response) => {
    // Used for checking if this snake is still alive.
    return response.json({});
});

app.use('*', fallbackHandler);
app.use(notFoundHandler);
app.use(genericErrorHandler);

app.listen(app.get('port'), () => {
    console.log('Server listening on port %s', app.get('port'));
});
