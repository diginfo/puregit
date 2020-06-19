#!/usr/bin/env node

if(!global.$) global.$ = {};

$ = Object.assign($,require('./config.json'));

// ...args
const ce = function(...args){
  args.map(function(e,i){args[i] = style(e,'fgr')})
  console.error(...args);
  _fs.appendFileSync(_path.join('/var/log','puredev-err.log'),`${args.join('\n')}\n`);
}

const cl = console.log;
const jl = function(obj,str){
  str=str||'';
  try {cl(str,style(JSON.stringify(obj),'fgc'))}
  catch(e){cl(e)};
}

const script      = !module.parent;
const exit        = process.exit;

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
const _crypto     = require('crypto');

const {promisify} = require('util');

var _lastnote = '';

function sha(str){
  str = str || Math.random().toString();
  return _crypto.createHash('sha').update(str).digest('base64');
}

function isopt(opt){
  return (_opts.indexOf(opt)>-1)
}

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
    if(!row) return;
    var line = `${lpad(i+1)}. ${row}`
    if(sty) cl(style(line,sty));
    else cl(line);   
  })  
}

function oblist(obj,sty){
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
  const data = require(_path.join($.source.path,'data','gitdata.json'));
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

// returns 
function selectFiles(repo,cb=cl){
  const src = source(repo);
  

  _git.changedFiles(src.path,function(files){ 
    // check for local versions of file info.
    locals(src.locals,files,function(files){
   
      if(!files.length) {
        ce(`No ${_cmd} files..`)
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
        if((/^$|^x$|^q$/).test(idx)) return cb([]);
        else if((/\*|all/).test(idx)) var outs = files;
        else {
          idx = idx.split(/,|\s+/);
          var outs = [];
          idx.map(function(i){outs.push(files[i-1])});
        }
        
        return cb(outs);
      });
    })
  });
}

// console prompt
function prompt(msg,cb,def){
  var rl = newrl();
  rl.question(style(`${msg} > `,'fgw'),function(res){
    setTimeout(function(){cb(res)}); 
    rl.close()  
  });
  if(def) rl.write(def);
}

function _prompt(arg,cb){
  var rl = newrl();
  rl.question(style(`${arg.msg} > `,'fgw'),function(res){
    cb(res);
    if(arg.close) rl.close();   
  });
  if(arg.def) rl.write(arg.def);
}

function dodir(file) {  
  var dir = _path.dirname(file);
  try {_fs.statSync(dir)} catch(e) {_fs.mkdirSync(dir)}
}

function quit(msg='Quit.'){
  if(msg) cl(style(msg,'fgr'));
  exit();
}

function rm(){
  prompt('Enter File Path', function(fn){
    if((/^$|^x$|^q$/).test(fn)) quit('File path is required.');
    _git.fileRm($.source.path,{name:fn},function(){
      _git.fileRm($.target.path,{name:fn},cl);
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
  if(isopt('lock')) return flagLock(flags);
  else if(isopt('unlock')) return flagUnlock(flags);
  return flags;
}

function lockUnlock(mode,cb){
  prompt('Enter File Path', function(fn){
    if((/^$|^x$|^q$/).test(fn)) quit('File path is required.');
dir = $.source.path;
    _git.infoGet(dir,fn,function(file){
      file.force = true;
      if(mode=='lock') file.flags = flagLock(file.flags);
      else file.flags = flagUnlock(file.flags);
      _git.fileCommit($.source.path,file,function(){
        _git.push($.source.path,cb)
      })  
    });
  },_args[0]);  
}

function conLock(cb=cl){
  lockUnlock('lock',cb)
}

function conUnlock(cb=cl){
  lockUnlock('unlock',cb)
}

// Release notes (binary only)
function releaseNotes(repo,cb){
  if(repo=='target') return cb();
  else prompt('Enter Release Notes',cb,'Development');    
}


// console main release func
function release(repo='target'){
  const src = source(repo);
  selectFiles(repo,function(files){
    if(!files.length) exit();
    releaseNotes(repo,function(note){
      _async.eachSeries(files,function(file,next){
        if(note) file = _git.addNote(file,note);
        cl(style(`> ${file.name} ver: ${file.ver}`,'fgw'));
        _git.fileCommit(src.path,file,function(){
          next();
        });
      },function(){
        
        /* RELEASE-DONE */
        _git.push(src.path,function(){
          h2(`Released files (${files.length})`);
          list(files.map(function(file){
            return `${rpad(file.name,20)} - ${file.notes[0]||''}`;  
          }))   // list
        });     // _git.push()
      })        // _async.each()
    })          // selectFiles() 
  })            // rel_notes();
    
}

// fails 
function pugBuild(fn,cb=cl){
  fn = fn.replace($.pug.basedir,'');
  const fname = _path.basename(fn);
  //if(!$.pug.enabled) return quit('pug is disabled.')
  const html = _path.join($.source.path,$.pug.basedir);
  const fp  = _path.join(html,fn);
  var src = _fs.readFileSync(fp,'utf-8');
  
  if((/_inc.pug$/).test(fname)){
    if((/^extends\s\S*/).test(src)) return cb({
      error : true,
      msg   : `[${fname}] _inc files cannot extend.`,
      code  : src
    });
  }
  
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

// generic build css and js
function buildTry(fn,cb=cl){
  const sfn = _path.join($.source.path,fn);
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
      sfn : _path.join($.source.path,fn),
      rfn : _path.join($.target.path,fn)
    }    
  }
  
  // write js/css & commit
  function buildWrite(file,code,cb=cl){
    const {sfn,rfn} = fns(file.name);
    //cl(`buildWrite(',${rfn})`);
    file.notes = file.notes || [];
    const comment = `${JSON.stringify({sha:sha(code),ver:file.ver,notes:file.notes.join(':')})}`; 
    if(_path.extname(file.name) == '.pug') code = `${code}\n\n//- ${comment}\n`;
    else code = `/*${comment}*/\n${code}`;
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
      prompt(`Enter Notes`,function(notes){
        
        if(notes && !(/^$|^x$|^q$/).test(notes)) {
          file.notes = notes;
          _lastnote = notes;
        } 
        
        else quit('Notes are required.');
      
        // commit the file.
        _git.fileCommit($.source.path,file,function(data){
          proc.push(file);
          next();
        });   
      
      },file.notes[0] || _lastnote);  // prompt-notes      
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
          if(build.error) return done(build);
          buildWrite(file,build.code,done); 
        });
        break;
        
      default:
        copyFile(file,done);
        break;        
    }   // switch
  },function(){
    _git.push($.source.path,function(){
      if(cb) cb(proc);
    });
  })

}

// Command line Build.
function comBuild(){
  selectFiles('source',function(files){
    
    if($.debug > 1) cl('build-ops:',_opts);
    if(_opts.length) files.map(function(file,idx){
      file.flags = islock(file.flags);
    })
    
    buildFiles(files,function(proc){
      if(files.length) cl(`Build Done (${files.length}) files.`);
      if(isopt('restart')){
        cl('restarting node service...');
        _git.shell('pm2 restart 2;');         
      }
    });
  });
}

// generic directory listing.
function dirlist(dir,cb=cl){
  var subfilter = /node_modules|js3|public\/pdfview/;
  var dirs = _fs.readdirSync(dir).filter(function (file) {
    var dn = _path.join(dir,file);
    if(_fs.statSync(dn).isDirectory()){
      if (!(/^\.|node_modules|script/).test(file)) return dn;
    }
  });
  dirs.unshift('/');
  cb(dirs);
}

// console dir prompts
function conDirs(dir,cb=cl){
  dirlist($.source.path,function(dirs){
    list(dirs);
    dirs[0]='.';
    prompt('Select Folder',function(idx){
      if((/^$|^x$|^q$/).test(idx) || isNaN(idx) || idx > dirs.length || idx < 1) quit('Invalid Selection.')
      cb(_path.join($.source.path,dirs[idx-1]))
    });
  })
}

// console tree
function conTree(cb=cl){
  h2(`Project Folders`)
  conDirs($.source.path,function(path){
    _git.shell(`/usr/bin/tree ${path} -L 4;`,cb)
  })
}

// generic find {mode,path,str}
function find(arg,cb){
  arg.str = arg.str.replace(/^\*|$\*/,'');
  
  cmd = {
    f: `find ${arg.path} -wholename "*${arg.str}*"`,
    t: `grep -r -l "${arg.str}" ${arg.path};`  
  }[arg.mode];
  
  _git.shell(cmd,function(fn){
    if(fn.error) fn='';
    var files =[];
    fn.split('\n').map(function(e){
      files.push(e.replace(`${arg.path}/`,''));  
    });
    cb(files);
  });
}

// binary build
function binBuild(cb){
  var cmd =`/bin/bash ${$.binary.path}/private/build;`;
  _git.shell(cmd,cb);       
}

// binary release
function binRelease(note,cb){
  var cmd =`cd ${$.binary.path} && git commit -a -m "${note}" && git push;`;
  _git.shell(cmd,cb);       
}

// console find prompts
function conFind(arg,cb){
  conDirs($.source.path,function(path){
    prompt('Enter Search String',function(str){
      find({
        mode  : arg.mode,
        path  : path,
        str   : str
      },cb)
    }) 
  })  
}

// console spinning loader
function conLoading(quit) {
  if(quit) return clearInterval($.loader);
  process.stdout.write("\r");
  var P = ["\\", "|", "/", "-"];
  var x = 0;
  $.loader = setInterval(function() {
    process.stdout.write("\r" + P[x++]);
    x &= 3;
  }, 250);
};

// console find files
function conFindFiles(cb=cl){
  conFind({mode:'f'},cb) 
}

// console fine text
function conFindText(cb=cl){
  conFind({mode:'t'},cb) 
}

// console binary builds
function conBinary(){

  if((/^release/).test(_opts)) {
    release('binary');
  }

  else if((/^build/).test(_opts)) {
    cl('This will take up to 1 minute.')
    prompt('Proceed ? [y/n]',function(yn){
      if(yn.toLowerCase()!='y') exit(); 
      cl('Please wait...');
      conLoading();
      binBuild(function(ok){
        conLoading(true);
        cl('Binary build complete.');    
      });       
    })
  }
  
  else quit('bad option');
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
  row('Build File(s)','puredev build [-lock|-unlock|dir/file]')
  row('Release File(s)','puredev rel|release [dir/file]')

  h2('Pure Binary')
  row('Build & Release','puredev binary -build -release')
  
  h2('Modify Files')
  row('Lock File','puredev lock dir/file')
  row('Unlock File','puredev unlock dir/file')
  row('Delete File','puredev rm dir/file')
  
  h2('File Info')
  row('Find File(s)','puredev findFiles')
  row('Find Text','puredev findText')
  row('Validate File','puredev validate dir/file')
  row('File Info','puredev info dir/file')
  row('Tree List','puredev tree')
  row('Locked List','puredev locked')
  cl();
}

function doargs(){
  var dels=[];
  _args.map(function(arg,idx){
    if((/^-+/).test(arg)) {
      _opts.push(arg.replace(/^-+/,''));
      dels.push(idx);
    };
  })
  dels.reverse().map(function(idx){
    _args.splice(idx,1)
  })
}

// {path,info,locals}
function source(dir){return $[dir]}

// files info NOT in source repo.
function locals(list,files,cb){

  if(_uid != 'pac') return cb(files);
  
  // list changed files & see if in locals.
  var done=[], locs = []; files.map(function(file){
    //cl(file);
    //if((/^pure3-linux-a*/).test(file.name)) cl(file);
    if(list.indexOf(file.name)>-1) locs.push(file.name);
    else done.push(file);  
  });
  
  // get file-info from non-source path.
  if(locs.length) _git.infosGet($.binary.path,locs,function(infos){
    for(var k in infos){
      infos[k].ver = _git.verInc(infos[k].ver); // increment version
      done.push(infos[k]);  
    }
    cb(done); 
  })
  
  else cb(files);
}

/* ### RUN ### */
doargs();

if(isopt('debug')) {
  $.debug = 2;
  cl(`options: ${_opts.join(',')}`);
  cl(`args: ${_args.join(',')}`);
  if(isopt('exit')) process.exit();
}

if(_uid=='pac'){

  // ce('xxx','yyy'); process.exit();

  // h1('PAC-DEV')
  if(isopt('dev')){
    $.source.path = '/usr/share/dev/nodejs/src/pure-git/src/tests';
    $.target.path = '/usr/share/dev/nodejs/src/pure-git/run/testr';
    $.deploy.path = '/usr/share/dev/nodejs/src/pure-git/dep/testr';
  }

  function history(cb=cl){
    _git.exec($.source.path,{args:["whatchanged","--name-only","--oneline","--since",'06/01/2020',"--until",'06/02/2020']},function(rows){
      cl(rows);  
    })
  }

  function comRevert(){
    prompt('Enter File Path',function(path){
    dir = $.source.path;
      _git.infoGet(dir,path,function(file){
        _git.revert($.source.path,file,function(ok){
          cl(ok);  
        })  
      })    
      
    },_args[0]) ;
  }

}

switch(_cmd) {
  
  case 'changedFiles':
    _git.changedFiles($.source.path);
    break;

  case 'info':
    prompt('Enter File Path',function(path){
dir = $.source.path;
      _git.infoGet(dir,path,function(data){
        h2(`File Info`)
        delete(data.data);
        data.notes = data.notes.join()  
        list(data);
      });
    },_args[0])
    break;

  case 'revert':
    comRevert();
    break;

  case 'infoSet':
    infoSet(_args[0].trim());
    break;
    
  case 'build':
    comBuild();
    break;

  case 'binary':
    conBinary();
    break;

  case 'rel':
  case 'release':
    release('target');
    break;

  case 'locked':
    _git.locked(function(files){
      h2('Locked Files')
      list(files,'fgr');  
    });
    break;

  case 'lock':
    conLock();
    break;
  
  case 'fileFind':
  case 'filesFind':
  case 'findFile':
  case 'findFiles':
    conFindFiles(function(files){
      h2('Found Files');
      list(files);
      cl()  
    });
    break;

  case 'textFind':
  case 'findText':
    conFindText(function(files){
      h2('Found Files With Text');
      list(files);
      cl()  
    });
    break;

  case 'unlock':
    conUnlock();
    break;

  case 'rm':
    rm();
    break;

  case 'tree':
    conTree();
    break;

  case 'deploy':
    deploy($.deploy.path,cl);
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

