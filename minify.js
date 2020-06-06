#!/usr/bin/env node

const cl = console.log;
const ce = console.error;
const fs = require('fs');
const ujs = require("uglify-es");
const css = require('clean-css');
const path = require('path');

module.exports.css = function(file,cb=cl){
  if(!file.endsWith('.css')) return cb();
  var fname = path.basename(file);
  fs.readFile(file, "utf8",function(err,code){
    if(err) {
      return cb(errmsg(fname,code,err));
    }
    var min = new css().minify(code);
    cl(min);
/*
    { styles: 'body:{background:red}',
    stats: 
     { efficiency: 0.36363636363636365,
       minifiedSize: 21,
       originalSize: 33,
       timeSpent: 13 },
    errors: [],
    inlinedStylesheets: [],
    warnings: [ 'Invalid character(s) \'dadadada\' at 2:0. Ignoring.' ] }
*/
    if(min.styles) cb(min.styles);
  })  
}

function errmsg(fname,code,error){
  var msg = '';
  code.split('\n').map(function(row,i){
    if(parseInt(i+1) == parseInt(error.line)) msg = `COMPILE ERROR: ${fname}, [${error.message} line:${error.line} col:${error.col}] = [ ${row.substr(error.col,50)} ]`;
  });
  return ({code:code,error:true,msg:msg});
}

module.exports.js = function(file,cb){
  if(!file.endsWith('.js')) return cb();
  var fname = path.basename(file);
  var pre = '_x_=';
  fs.readFile(file, "utf8",function(err,code){
    if(err) {
      ce('jsmin()',err.message);
      return cb();
    }
    code = code.trim().replace(/#\!\/usr\/bin\/env nodejs|#\!\/usr\/bin\/env node/,'');//.replace(/\.js$/g,'.min.js')
    if(code.indexOf('{')==0 || code.indexOf('function')==0) code = pre+code;
    
    try {
      var opts = {sourceMap: {filename: fname}}
      var min = ujs.minify(code,opts);
      if(min.error) return cb(errmsg(fname,code,min.error));
      else {
        cb({
          error : false,
          code  : min.code.replace(pre,''),
          map   : min.map
        });
      }
    } 
    
    catch(err){
      ce('ERROR:',fname,err.message)
      return cb();
    }  
  });
}