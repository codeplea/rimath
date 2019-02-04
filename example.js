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

