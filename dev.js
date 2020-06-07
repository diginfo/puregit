#!/usr/bin/env node

if(!global.$) global.$ = {};

$ = Object.assign($,require('./config.json'));

if(1==2){
  $.source = '/usr/share/dev/users/pac/api/src/tests';
  $.target = '/usr/share/dev/users/pac/api/run/testr';
  $.deploy = '/usr/share/dev/users/pac/api/dep/testr';
}

if(1==2){
  $.source = '/usr/share/dev/nodejs/src/ve3';
  $.target = '/usr/share/dev/nodejs/run/ve3';
}

const ce = function(e1){console.error(style(e1,'fgr'))}
const cl = console.log;
const exit = process.exit;

const _args       = process.argv.splice(2);
const _cmd        = _args.shift();
const _opts       = [];
const _uid        = process.env.UID3;
const _gituid     = process.env.GITUID;
const _gitpak     = process.env.GITPAK;

const _readline   = require('readline');
const _path       = require('path');
const _fs         = require('fs');
const _async      = require('async');
const _min        = require('./minify');
const _git        = require('./git');
const _pug        = require('pug');

const {promisify} = require('util');

var _lastnote = '';

// styling the console output.
function style(str,sty,noclr){
  var cols={res: "\x1b[0m",bright : "\x1b[1m",dim : "\x1b[2m",ul : "\x1b[4m",blink : "\x1b[5m",rev : "\x1b[7m",hide : "\x1b[8m",fgk : "\x1b[30m",fgr : "\x1b[31m",fgg : "\x1b[32m",fgy : "\x1b[33m",fgb : "\x1b[34m",fgv : "\x1b[35m",fgc : "\x1b[36m",fgw : "\x1b[37m",bgk : "\x1b[40m",bgr : "\x1b[41m",bgg : "\x1b[42m",bgy : "\x1b[43m",bgb : "\x1b[44m",bgv : "\x1b[45m",bgc : "\x1b[46m",bgw : "\x1b[47m"};
  
  if(typeof sty =='string') sty=[sty];
  sty.map(function(e){str = cols[e]+str;})
  if(!noclr) str += cols['res'];
  return str;
}

function h1(txt,len=10){
  const tlen = txt.length;
  cl();
  cl(style(rpad(lpad(` ${txt} `,tlen+len,'-'),tlen+len*2,'-'),'bgb'))  
}
function h2(txt){cl(style(`\n${txt}`,['fgc','ul']))}

function list(list,sty){
  if(!Array.isArray(list)) return oblist(list,sty);
  list.map(function(row,i){
    var line = `${lpad(i+1)}. ${row}`
    if(style) cl(style(line,sty));
    else cl(line);   
  })  
}

function oblist(obj){
  for(var k in obj){
    cl(`${lpad(k,8)} : ${JSON.stringify(obj[k]).replace(/"/g,'')}`)    
  }  
}

function rpad(data,len=2,chr=' '){
  return data.toString().padEnd(len,chr)
}

function lpad(data,len=2,chr=' '){
  return data.toString().padStart(len,chr)
}

const pad = lpad;

function newrl(){
  return _readline.createInterface({input: process.stdin,output: process.stdout}); 
}

function dbInit(){
  const sqlite3 = require('sqlite3');
  const data = require(_path.join($.source,'data','gitdata.json'));
  const db = new sqlite3.Database(_path.join(__dirname,'gitdata.db'));

  function get(sql,cb){
    db.all(sql,cb);	
    db.close();
  }
  
  function put(sql,cb){
    db.run(sql,cb);
  }
  
  const sql = 'DELETE FROM files;DELETE FROM rels;';
  put(sql,cl);
  
  var paths = Object.keys(data);
  _async.eachSeries(paths,function(path,nextpath){
      const file = data[path];
      const sql = `INSERT INTO files (path,ver,notes) VALUES('${path}','${file.ver.join('.')}','${file.notes.join(',')}');`;
      put(sql,function(ok){
        const rels = Object.keys(file.rels);
        _async.eachSeries(rels,function(rel,nextrel){
          const sql = `INSERT INTO rels (path,rel,notes) VALUES('${path}','${rel}','${file.rels[rel].notes.join(',')}');`;
          put(sql,function(){nextrel()});        
        },function(){
          nextpath();
        });
      })
    },function(){
      get('select * from files',function(err,rows){
        cl(rows[0]);
        cl('@@@ done');  
      });
      
  })
}

function selectFiles(dir,cb=cl){
  _git.changedFiles(dir,function(files){

    if(!files.length) {
      cl('\n=================\nNo Changed Files.\n=================\n');
      return cb([]);
    }

    // file name supplied as arg 1.
    if(_args[0]){
      var file = files.find(x => x.name === _args[0]);
      if(file) return cb([file]);
    }
    
    var sty = ['bgb','fgw']
    cl()
    cl(`${style(lpad('#',2),sty)} ${style(lpad('VER',6),sty)} ${style(rpad('PATH',30),sty)}`)
    files.map(function(file,idx){
      var msg = `${lpad(idx+1)} ${lpad(file.ver,6)} ${file.name}`; 
      if(file.lock) msg = style(msg,'fgr');
      cl(msg);
    })
    cl()
    
    prompt('Select File(s)', function(idx){
      if(!idx || (/q|x/).test(idx)) return cb([]);
      else if((/\*|all/).test(idx)) var outs = files;
      else {
        idx = idx.split(/,|\s+/);
        var outs = [];
        idx.map(function(i){outs.push(files[i-1])});
      }
      
      return cb(outs);
    });
  })
}

function prompt(msg,cb,def){
  const rl = newrl();
  rl.question(style(`${msg} > `,'fgw'),function(res){
    cb(res);
    rl.close();   
  });
  if(def) rl.write(def);
}

function dodir(file) {  
  var dir = _path.dirname(file);
  try {_fs.statSync(dir)} catch(e) {_fs.mkdirSync(dir)}
}

function notes(file,cb){
  function go(){
    prompt(`Notes`,cb,_lastnote);
  }
  go();
  
  /*
  if(_lastnote) prompt(`Use notes [${_lastnote}] for all ? (y/n)`,function(yn){
    if(yn.toLowerCase() == 'y') return cb(_lastnote);
    else go();
  }); 
  
  else go();
  */

}

function quit(msg='Quit.'){
  if(msg) cl(style(msg,'fgr'));
  exit();
}

function rm(){
  prompt('Enter File Path', function(fn){
    if(!fn || (/q|x/).test(fn)) quit('File path is required.');
    _git.fileRm($.source,{name:fn},function(){
      _git.fileRm($.target,{name:fn},cl);
    })
  })
}

function flagLock(flags){
  if(!(/L/).test(flags)) flags += 'L';
  return flags;    
}

function flagUnlock(flags){
  return flags.replace(/L/g,'');   
}

function islock(flags){
  if(_opts.indexOf('lock') >-1) return flagLock(flags);
  else if(_opts.indexOf('unlock') >-1) return flagUnlock(flags);
  return flags;
}

function lockUnlock(mode,cb){
  prompt('Enter File Path', function(fn){
    if(!fn || (/q|x/).test(fn)) quit('File path is required.');
    _git.infoGet(fn,function(file){
      file.force = true;
      if(mode=='lock') file.flags = flagLock(file.flags);
      else file.flags = flagUnlock(file.flags);
      _git.fileCommit($.source,file,function(){
        _git.push($.source,cb)
      })  
    });
  },_args[0]);  
}

function lock(cb=cl){
  lockUnlock('lock',cb)
}

function unlock(cb=cl){
  lockUnlock('unlock',cb)
}

function release(){
  selectFiles($.target,function(files){
    _async.eachSeries(files,function(file,next){
      cl(style(`> ${file.name}`,'fgw'));
      _git.fileCommit($.target,file,function(){
        next();
      });
    },function(){
      
      /* RELEASE-DONE */
      _git.push($.target,function(){
        cl(`Release Done (${files.length}) files.`)
      });
    })
  }) 
    
}

function pugBuild(fn,cb=cl){
  fn = fn.replace($.pug.basedir,'');
  const fname = _path.basename(fn);
  //if(!$.pug.enabled) return quit('pug is disabled.')
  const html = _path.join($.source,$.pug.basedir);
  const fp  = _path.join(html,fn);
  var src = _fs.readFileSync(fp,'utf-8');
  
  return cb({
    error : false,
    msg   : `[${fname}] Build Success.`,
    code  : src
  })
  
  /*
  
  // include files.
  var incs = [];
  $.pug.includes.map(function(inc){incs.push(`include /${inc}`)});
  incs = incs.join('\n')+'\n';
  
  try {
    const code = _pug.compile(incs+src,{
      basedir       : html,
      compileDebug  : true,
      filename      : fp
    })();
    cb({error:false,msg:`[${fname}] Build Success.`,file:fn,code:code});
    
  } catch(err){
    ce(err);
    cb({error:true,msg:`ERROR: ${err.msg} at line ${err.line}, column ${err.column}`,file:fn})
  }
  */
}

function buildTry(fn,cb=cl){
  fn = fn || _args[0];
  const sfn = _path.join($.source,fn);
  const extn = _path.extname(fn).replace(/^\./,'');
  
  function done(ok){
    return cb(ok);   
  }
  
  switch (extn){
    case 'js':
      _min.js(sfn,done);
      break;
    
    case 'css':
      _min.css(sfn,done);
      break;
    
    case 'jade':
    case 'pug':
      pugBuild(fn,done);
      break;
      
    default:
      return cb({error:true,msg:`cannot verify ${extn} files.`});
  }
}

function buildFiles(files,cb){
  const proc = [];
  
  // file paths
  function fns(fn){
    return {
      sfn : _path.join($.source,fn),
      rfn : _path.join($.target,fn)
    }    
  }
  
  // write js/css & commit
  function buildWrite(file,code,cb=cl){
    const {sfn,rfn} = fns(file.name);
    //cl(`buildWrite(',${rfn})`);
    _fs.writeFile(rfn,code,'utf-8',function(){
      cb();
    });
  }

  // write other files & commit. ({sfn,rfn,file})
  function copyFile(file,cb=cl){
    const {sfn,rfn} = fns(file.name);
    //cl(`copyFile('${sfn},${rfn})`);
    const ws = _fs.createWriteStream(rfn); 
    const rs = _fs.createReadStream(sfn).pipe(ws);
    ws.on('finish', function(){cb()});
  }

  _async.eachSeries(files,function(file,next){
    cl(style(`> ${file.name}`,'fgw'));
    function done(min){
      
      // js/css compile error.
      if(min && min.error) {
        quit(min.msg)
      }
      
      // prompt for notes.
      notes(file,function(notes){
        
        if(notes && !(/q|x/).test(notes)) {
          file.notes = notes;
          _lastnote = notes;
        } 
        
        else quit('Notes are required.');
      
        // commit the file.
        _git.fileCommit($.source,file,function(data){
          proc.push(file);
          next();
        });   
      
      });  // notes      
    }
    
    file.ver = _git.verInc(file.ver); // increment version.
    var extn = _path.extname(file.name).replace(/^\./,'');
    const {sfn,rfn} = fns(file.name);
    dodir(rfn); // create folder if not exists.
    
    switch (extn){
      case 'jade':
      case 'pug':
      case 'js':
      case 'css':
        buildTry(file.name,function(build){
          //quit(JSON.stringify(build.code));
          if(build.error) return done(build);
          //else cl(build.msg);
          buildWrite(file,build.code,done); 
        });
        break;
        
      default:
        copyFile(file,done);
        break;        
    }   // switch
  },function(){
    _git.push($.source,function(){
      if(cb) cb(proc);
    });
  })

}

// Command line Build.
function build(){
  selectFiles($.source,function(files){
    
    if($.debug > 1) cl('build-ops:',_opts);
    if(_opts.length) files.map(function(file,idx){
      file.flags = islock(file.flags);
    })
    
    buildFiles(files,function(proc){
      if(files.length) cl(`Build Done (${files.length}) files.`);
    });
  });
}

function deploy(dir,cb=cl){
  function sqlfiles(cb){
    //return cb([]);
    cb([
      'sql/xxxx.sql',
      've3-linux-aa',
      'prpt/report.prpt',
    ])
  }
}

function infoSet(file,cb){
  infoGet(file,function(info){
    fileCommit(dir,file,function(){
      
    });
  });
}

function tree(cb=cl){
  var dir = {
    'mod'   : 'mod',
    'prpt'  : 'prpt',
    'lib'   : 'lib',
    'html'  : 'html/eui',
    'sql'   : 'sql'
  };
  
  if(!_args[0] || !dir[_args[0]]) quit('Folder name is required.');
  
  var path = _path.join($.source,dir[_args[0]]);
  if(_args[1]) path = _path.join(path,_args[1]);
  
  _git.shell(`/usr/bin/tree ${path} -L 4;`,cb)
}

function findFile(){
  
}

function findText(cb){
  _git.shell(`cd ${$.source}; /bin/grep -r "${_args[0]}";`,cb)  
}

function readme(cb=cl){
  const cmd = `${_path.join(__dirname,'glow')} README.md`;
  _git.shell(cmd,function(rows){
    process.stdout.write(rows);
  })
}

function help(){
  function c1(txt){return rpad(txt,15)}
  function row(c1,c2){cl(rpad(c1,15),`: ${c2}`)}
  h1('PUREDEV HELP')
  
  h2('Develop')
  row('Build File(s)','puredev build [-lock|-unlock|file/path]')
  row('Release File(s)','puredev release [file/path]')
  
  h2('Modify')
  row('Lock File','puredev lock file/path')
  row('Unlock File','puredev unlock file/path')
  row('Delete File','puredev rm file/path')
  
  h2('Info')
  row('Validate File','puredev validate file/path')
  row('File Info','puredev info file/path')
  row('Tree List','puredev tree mod|prpt|lib|html|sql [sub-dir]')
  row('Locked List','puredev locked')
  cl();
}

_args.map(function(arg,idx){
  const opt = arg.match(/^-+(.*)/);
  if(opt) {
    _opts.push(opt[1]);
    _args.splice(idx,1);
  };
  //if($.debug > 1) cl('_opts:',_opts)
})

/*
try {
  cl(_cmd)
  [_cmd](_args[0]);
} catch(e){}
*/


switch(_cmd) {
  
  case 'changedFiles':
    _git.changedFiles($.source);
    break;

  case 'info':
    _git.infoGet(_args[0].trim(),function(data){
      h2(`File Info`)
      list(data);
    });
    break;

  case 'infoSet':
    infoSet(_args[0].trim());
    break;
    
  case 'build':
    build();
    break;

  case 'release':
    release();
    break;

  case 'locked':
    _git.locked(function(files){
      h2('Locked Files')
      list(files,'fgr');  
    });
    break;

  case 'lock':
    lock();
    break;

  case 'unlock':
    unlock();
    break;

  case 'rm':
    rm();
    break;

  case 'tree':
    tree();
    break;

  case 'deploy':
    deploy($.deploy,cl);
    break;
  
  case 'validate':
    prompt('Enter File Path',function(path){
      buildTry(path,function(ok){
        if(ok.error) ce(ok.msg);
        else cl(ok.msg);  
      });
    },_args[0])
    break;
  
  case 'help': 
  default:
    help();

}


//cl($)

/*

cl(ino,style(`${e} (lock)`,'fgr'))

7 > 8 and modified

git status -s
 D pactest7.css
?? pactest8.css

git add -A
git status -s
D  pactest7.css
A  pactest8.css

== ====== ============
 #    VER PATH
== ====== ============
 1      3 pactest7.css (D)
 2      3 pactest8.css (A)
 
*/

