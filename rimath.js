// Copyright (C) 2013-2019 Lewis Van Winkle
//
// This software is provided 'as-is', without any express or implied
// warranty. In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//    claim that you wrote the original software. If you use this software
//    in a product, an acknowledgement in the product documentation would be
//    appreciated but is not required.
// 2. Altered source versions must be plainly marked as such, and must not be
//    misrepresented as being the original software.
// 3. This notice may not be removed or altered from any source distribution.


/*
 * Usage:
 * var rimath = require('./rimath.js');
 * expr = rimath.compile("100+5*2");
 * console.log(expr()); //110
 */





(function(exports){


  //When things go wrong, we return this as an error object.
  //Type can be:
  //  arity: bad arity or function consumed to many inputs.
  //  paren: unmatched parenthesis
  //  sep: used a comma without parenthesis
  //  syntax: general bad input
  //  unspecified: a bug
  //  undefined: an unknown function/variable was called.
  //
  var rimath_error = function (text, index, token, type) {
    return {text: text, index: index, token: token, type: type};
  };


  //General helper.
  var peek = function (arr) {
    return arr[arr.length-1];
  };


  //Predefined functions and their arity.
  var func_table = {
    '||': [2, function(s){var x = s.pop(), y = s.pop(); s.push(y || x);}],

    '&&': [2, function(s){var x = s.pop(), y = s.pop(); s.push(y && x);}],

    '==': [2, function(s){s.push(s.pop() == s.pop() ? 1 : 0);}],
    '!=': [2, function(s){s.push(s.pop() != s.pop() ? 1 : 0);}],
    '<>': [2, function(s){s.push(s.pop() != s.pop() ? 1 : 0);}],

    '<' : [2, function(s){s.push(s.pop() > s.pop() ? 1 : 0);}],
    '>' : [2, function(s){s.push(s.pop() < s.pop() ? 1 : 0);}],
    '<=': [2, function(s){s.push(s.pop() >= s.pop() ? 1 : 0);}],
    '>=': [2, function(s){s.push(s.pop() <= s.pop() ? 1 : 0);}],

    '+' : [2, function(s){s.push(s.pop() + s.pop());}],
    '-' : [2, function(s){var x = s.pop(), y = s.pop(); s.push(y - x);}],

    '*' : [2, function(s){s.push(s.pop() * s.pop());}],
    '%' : [2, function(s){var x = s.pop(), y = s.pop(); s.push(y % x);}],
    '/' : [2, function(s){var x = s.pop(), y = s.pop(); s.push(y / x);}],

    '^' : [2, function(s){var x = s.pop(), y = s.pop(); s.push(Math.pow(y, x));}],

    'sqrt' : [1, function(s){s.push(Math.sqrt(s.pop()));}],
    '!' : [1, function(s){s.push(s.pop() ? 0 : 1);}],
    'u-' : [1, function(s){s.push(-s.pop());}],

    'sin' : [1, function(s){s.push(Math.sin(s.pop()));}],
    'cos' : [1, function(s){s.push(Math.cos(s.pop()));}],
    'tan' : [1, function(s){s.push(Math.tan(s.pop()));}],

    'round' : [2, function(s){var x = s.pop(), y = s.pop(); s.push(Math.round(y/x)*x);}],

    'pi' : [0, function(s){s.push(Math.PI);}],
    'e' : [0, function(s){s.push(Math.E);}],
    'identity' : [1, function(s){s.push(s.pop());}],
    'abs' : [1, function(s){s.push(Math.abs(s.pop()));}],
    'log' : [1, function(s){s.push(Math.log(s.pop()) / Math.LN10);}],
    'ln' : [1, function(s){s.push(Math.log(s.pop()));}],
    'exp' : [1, function(s){s.push(Math.exp(s.pop()));}],

    'floor' : [1, function(s){s.push(Math.floor(s.pop()));}],
    'ceil' : [1, function(s){s.push(Math.ceil(s.pop()));}],
    'if' : [3, function(s){var x = s.pop(), y = s.pop(), z = s.pop(); s.push(z ? y : x);}]

  };


  //Store operator precedence and associativity (true for left associative).
  //All prefix operators are assumed max precedence and right associative.
  var pred_table = {
    '||': [1, true],

    '&&': [2, true],

    '==': [3, true],
    '!=': [3, true],
    '<>': [3, true],

    '<' : [4, true],
    '>' : [4, true],
    '<=': [4, true],
    '>=': [4, true],

    '+' : [5, true],
    '-' : [5, true],

    '*' : [6, true],
    '%' : [6, true],
    '/' : [6, true],

    '^' : [7, false]
  };


  //Takes input string with infix notation and returns tokenized array with the index of each token.
  //It will detect negative numbers, but can also return unary negation operator:
  //e.g. "-(9+-5)" will tokenize as [
  //  ['prefix', 'u-', 0],
  //  ['paren', '(', 1],
  //  ['number', '9', 2],
  //  ['infix', '+', 3],
  //  ['number', '-5', 4],
  //  ['paren', ')', 6]
  //].
  var tokenize = function (text, funcs, undef) {

    funcs = funcs || {};

    var last_token = 'sep';
    var ret = [];
    var t = text.toLowerCase();
    var open_parens = 0;

    while (t.length) {
      var m;

      if (t.match(/^\s/)) {
        t = t.substr(1); //Eat whitespace.

      } else if (t.match(/^[()]/)) {

        if (t[0] === '(') {
          ++open_parens;
        } else {
          --open_parens;
          if (open_parens < 0) {
            return rimath_error(text, text.length - t.length, t[0], 'paren');
          }
        }

        ret.push(['paren', t[0], text.length - t.length]);
        t = t.substr(1);

      } else if (last_token !== 'sep' && t.match(/^,/)) {
        ret.push(['sep', t[0], text.length - t.length]);
        last_token = 'sep';
        t = t.substr(1);

      } else if (last_token !== 'infix' && last_token !== 'sep' && last_token !== 'prefix' && (m = t.match(/^(<=|>=|!=|==|<>|&&|\|\||[\-\^+*%\/><])/))) {
        last_token = 'infix';
        ret.push(['infix', m[0], text.length - t.length]);
        t = t.substr(m[0].length);

      } else if (last_token !== 'value' && (m = t.match(/^(?:(?:-?[0-9]+(?:\.[0-9]*)?)|^(?:-?\.[0-9]+))(?:e[+\-]?\d+)?/))) {
        last_token = 'value';
        ret.push(['number', m[0], text.length - t.length]);
        t = t.substr(m[0].length);

      } else if ((m = t.match(/^(!|-|[\a-z]+[a-z0-9._]*'?)/))) {
        var func = funcs[m[0]] || func_table[m[0]];

        if (typeof func !== 'object') {
          if (typeof undef === 'function') {
            func = undef(m[0]);
            funcs[m[0]] = func;
          }
          if (typeof func !== 'object') {
            return rimath_error(text, text.length - t.length, m[0], 'undefined');
          }
        }

        var arity = func[0];
        if (arity === 0)
          last_token = 'value';
        else
          last_token = 'prefix';

        ret.push(['prefix', m[0] === '-' ? 'u-' : m[0], text.length - t.length]);
        t = t.substr(m[0].length);

      } else {
        return rimath_error(text, text.length - t.length, '', 'syntax'); //Return index of bad character.
      }
    }

    if (open_parens) {
      return rimath_error(text, text.length, '', 'paren');
    }

    return ret;
  };



  //Takes a tokenized infix array and provides a postfix expression.
  var postfix = function (infix, funcs) {

    var stack = [];
    var output = [];

    var transfer = function () {
      var t = stack.pop();
      if (typeof t === 'object') {
        output.push(t[0]);
      } else {
        output.push(t);
      }
    };

    for (var i = 0; i < infix.length; ++i) {
      var type = infix[i][0];
      var tok = infix[i][1];

      if (type === 'number') {
        output.push(parseFloat(tok));

      } else if (type === 'infix' || type === 'prefix') {
        var pred = (type === 'prefix' ? 8 : pred_table[tok][0]);
        var la = (type === 'prefix' ? 0 : pred_table[tok][1]);

        var func = funcs[tok] || func_table[tok];

        if (typeof func !== 'object') {
          return rimath_error('', 0, tok, 'undefined');
        }
        while (typeof peek(stack) === 'object' && (la ? pred <= peek(stack)[1] : pred < peek(stack)[1])) {
          output.push(stack.pop()[0]);
        }
        stack.push([func, pred]);

      } else if (type === 'paren' && tok === '(') {
        stack.push(tok);

      } else if (type === 'paren' && tok === ')') {
        while(stack.length && peek(stack) !== '(') {
          transfer();
        }
        if (!stack.length) {
          return rimath_error('', 0, '', 'paren');
        }
        stack.pop();

      } else if (type === 'sep') {
        while(stack.length && peek(stack) !== '(') {
          transfer();
        }
        if (!stack.length) {
          return rimath_error('', 0, '', 'sep');
        }

      } else {
        return rimath_error('', 0, '', 'unspecified');
      }
    }

    while (stack.length) {
      transfer();
    }


    //Now check arity of everything.
    var depth = 0;
    for (var j = 0; j < output.length; ++j) {
      var t = output[j];
      if (typeof t === 'number') {
        depth++;
      } else if (typeof t === 'object') {
        var arity = t[0];
        output[j] = t[1];
        depth -= arity;
        depth++;
      }
    }

    if (depth !== 1) {
      return rimath_error('', 0, '', 'arity');
    }


    return output;
  };


  //Compile text expression and return function to execute it.
  //funcs is an array of [arity, function] arrays.
  exports.compile = function (text, funcs, undef) {

    var f = {};

    //Copy funcs since we will modify it.
    if (funcs) {
      for (var k in funcs)
        f[k] = funcs[k];
    }

    var t = tokenize(text, f, undef);
    if (!Array.isArray(t)) return t;


    var p = postfix(t, f);
    if (!Array.isArray(p)) {
      p.tokens = t;
      return p;
    }

    var ret = function() {
      var stack = [];

      for (var i = 0; i < p.length; ++i) {
        var t = p[i];
        if (typeof t === 'number') {
          stack.push(t);
        } else if (typeof t === 'function') {
          t(stack);
        }
      }

      return stack.pop();
    };

    ret.text = text;
    ret.tokens = t;
    ret.postfix = p;
    return ret;
  };

})(typeof exports === 'undefined' ? this.rimath = {} : exports);

