#!/usr/bin/env node

if(!global.$) global.$ = {};

$.__src = '/usr/share/dev/users/pac/api/src/tests';
$.__run = '/usr/share/dev/users/pac/api/run/testr';
$.__dep = '/usr/share/dev/users/pac/api/dep/testr';

if(1==1){
  $.__src = '/usr/share/dev/nodejs/src/pure3';
  $.__run = '/usr/share/dev/nodejs/run/pure3';
}

const _debug = 0;
const ce = function(e1){console.error(style(e1,'fg_red'))}
const cl = console.log;
const exit = process.exit;

const _args       = process.argv.splice(2);
const _cmd        = _args.shift();
const _opts       = [];
const _uid        = process.env.UID3;
const gituser     = process.env.GITUID;
const pat         = process.env.GITPAK;

const _readline   = require('readline');
const _path       = require('path');
const _fs         = require('fs');
const _async      = require('async');
const _min        = require('./minify');
const _git        = require('./gitmod');
const {promisify} = require('util');

_git.debug = _debug;
var _lastnote = '';

// styling the console output.
function style(str,sty,noclr){
  var cols={res: "\x1b[0m",bright : "\x1b[1m",dim : "\x1b[2m",ul : "\x1b[4m",blink : "\x1b[5m",reverse : "\x1b[7m",hide : "\x1b[8m",fg_blk : "\x1b[30m",fg_red : "\x1b[31m",fg_grn : "\x1b[32m",fg_yel : "\x1b[33m",fg_blu : "\x1b[34m",fg_pur : "\x1b[35m",fg_cyn : "\x1b[36m",fg_wht : "\x1b[37m",bg_blk : "\x1b[40m",bg_red : "\x1b[41m",bg_grn : "\x1b[42m",bg_yel : "\x1b[43m",bg_blu : "\x1b[44m",bg_pur : "\x1b[45m",bg_cyn : "\x1b[46m",bg_wht : "\x1b[47m"};
  
  if(typeof sty =='string') sty=[sty];
  sty.map(function(e){str = cols[e]+str;})
  if(!noclr) str += cols['res'];
  return str;
}

function rpad(data,len,chr=' '){
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
  const data = require(_path.join($.__src,'data','gitdata.json'));
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
    
    var sty = ['bg_blu','fg_wht']
    cl()
    cl(`${style(lpad('#',2),sty)} ${style(lpad('VER',6),sty)} ${style(rpad('PATH',30),sty)}`)
    files.map(function(file,idx){
      var msg = `${lpad(idx+1)} ${lpad(file.ver,6)} ${file.name}`; 
      if(file.lock) msg = style(msg,'fg_red');
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
  rl.question(style(`${msg} > `,'fg_wht'),function(res){
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
  prompt(`Notes [ ${file.name} ]`, function(notes){
    cb(notes);
  },_lastnote);
}

function quit(msg='Quit.'){
  if(msg) cl(style(msg,'fg_red'));
  exit();
}

function rm(){
  prompt('Enter File Path', function(fn){
    if(!fn || (/q|x/).test(fn)) quit('File path is required.');
    _git.fileRm($.__src,{name:fn},function(){
      _git.fileRm($.__run,{name:fn},cl);
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
      _git.fileCommit($.__src,file,function(){
        _git.push($.__src,cb)
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
  selectFiles($.__run,function(files){
    _async.eachSeries(files,function(file,next){
      _git.fileCommit($.__run,file,function(){
        next();
      });
    },function(){
      
      /* RELEASE-DONE */
      _git.push($.__run,function(){
        cl(`Release Done (${files.length}) files.`)
      });
    })
  }) 
    
}

function buildFiles(files,cb){
  const proc = [];
  
  // file paths
  function fns(fn){
    return {
      sfn : _path.join($.__src,fn),
      rfn : _path.join($.__run,fn)
    }    
  }
  
  // write js/css & commit
  function buildWrite(file,data,cb=cl){
    const {sfn,rfn} = fns(file.name);
    //cl(`buildWrite(',${rfn})`);
    _fs.writeFile(rfn,data,'utf-8',function(){
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
        _git.fileCommit($.__src,file,function(data){
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
      case 'js':
        _min.js(sfn,function(js){
          if(js.error) return done(js);
          else buildWrite(file,`/*${JSON.stringify(file)}*/${js.code}`,done); 
        });
        break;
      
      case 'css':
        _min.css(sfn,function(css){
          if(css.error) return done(css);
          buildWrite(file,`/*${JSON.stringify(file)}*/${css}`,done); 
        });
        break;
        
      default:
        copyFile(file,done);
        break;        
    }   // switch
  },function(){
    _git.push($.__src,function(){
      if(cb) cb(proc);
    });
  })

}

// Command line Build.
function build(){
  selectFiles($.__src,function(files){
    
    if(_debug > 1) cl('build-ops:',_opts);
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
      'pure3-linux-aa',
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

function help(){
  cl()
  cl(style('===================== HELP ======================','bg_blu'))
  cl('BUILD         : puredev build   [file-path|-lock|-unlock]');
  cl('RELEASE       : puredev release [file-path|-lock|-unlock]');
  cl('FILE-INFO GET : puredev infoGet file-path');
  cl('FILE-INFO SET : puredev infoSet file-path');
  cl('FILE DELETE   : puredev rm file-path');
  cl()
}

_args.map(function(arg,idx){
  const opt = arg.match(/^-+(.*)/);
  if(opt) {
    _opts.push(opt[1]);
    _args.splice(idx,1);
  };
  //if(_debug > 1) cl('_opts:',_opts)
})

switch(_cmd) {
  
  case 'changedFiles':
    _git.changedFiles($.__src);
    break;

  case 'infoGet':
    _git.infoGet(_args[0].trim());
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

  case 'lock':
    lock();
    break;

  case 'unlock':
    unlock();
    break;

  case 'rm':
    rm();
    break;

  case 'deploy':
    deploy($.__dep,cl);
    break;
    
  default:
    help();

}

/*

cl(ino,style(`${e} (lock)`,'fg_red'))

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

