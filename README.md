
# RiMath

RiMath is a small math expression evaluator in JavaScript. It uses the
[shunting-yard
algorithm](https://en.wikipedia.org/wiki/Shunting-yard_algorithm) to convert
expressions to [Reverse Polish
Notation](https://en.wikipedia.org/wiki/Reverse_Polish_notation).

This code is battle-tested and has been in use since 2013 at [Turnkey
Telemetry](https://turnkeytelemetry.com/), both server-side and client-side.

## Installation

If using Node.js, you can easily install with npm:

```
npm install rimath
```

Otherwise, just copy `rimath.js` into your project. It also works fine
client-side.


## Example Usage

```
var rimath = require('./rimath.js');


//Basic usage
var expr = rimath.compile("100+5*2");
console.log(expr()); //110


//Call external function
var triple = function(s) {s.push(s.pop()*3);};
var funcs = {trip: [1, triple]};
expr = rimath.compile("trip(100)", funcs);
console.log(expr()); //300



//Detect error (unbalanced paran)
expr = rimath.compile("1+(4*2");
console.log(expr); //{text: '1+(4*2', index: 6, token: '', type: 'paren'}
```
