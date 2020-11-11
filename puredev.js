#!/usr/bin/env node

/*
  
  2010-10-31 - PAC
  ISSUE: Update (git checkout) has been performed on folder(s)
  ERROR: detached HEAD
  ERROR: HEAD detached at 1a75b43
  FIX: git checkout master
  
  
*/


if(!global.$) global.$ = {};

$ = Object.assign($,require('./config.json'));

// Logging
const cl = console.log;

const cc = function(fgc,...args){
  fgc = fgc || 'fgg';
  args.map(function(e,i){args[i] = style(e,fgc)})
  cl(...args);
}

const ce = function(...args){
  cc('fgr',...args)
  _fs.appendFileSync(_path.join('/var/log','puredev-err.log'),`${args.join('\n')}\n`);
}

const cw = function(...args){
  cc('fgy',...args)
}

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

function filePerm(path){
  var stat = _fs.statSync(path);
  return '0' + (stat.mode & parseInt('777', 8)).toString(8);
}

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
  var i =1;
  for(var k in obj){
    cl(`${lpad(i,2)} ${lpad(k,6)} : ${JSON.stringify(obj[k]).replace(/"/g,'')}`);
    i++;    
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
  
  _git.changedFiles(src.path,src.info,function(files){ 
    
    //cl('[selectFiles]:1',files[36]);
    
    // check for local versions of file info.
    binLocals(src.locals,files,function(files){
   
      if(!files.length) {
        ce(`No ${_cmd} files..`)
        return cb([]);
      }
 
      // used in binary -release -all
      if(isopt('all')) return cb(files);
  
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

function infoSet(cb=cl){
  //quit('--amend only updates last commit. rebase ?')
  prompt('Enter File Path', function(fn){
    if((/^$|^x$|^q$/).test(fn)) quit('File path is required.');
    dir = $.source.path; // only update source files.
    _git.infoGet(dir,fn,function(file){
      list(file);
      file.path = _path.join(dir,file.name);
      const keys = Object.keys(file);          
      var key,val;
      prompt('Select Field', function(idx){
        if(isNaN(idx) || idx < 2 || idx > keys.length) quit('Invalid Seletion.');
        idx --;
        key = keys[idx];
        val = file[key];
        prompt(`Enter new value [${key}]`, function(nval){
          switch(key){
            case 'ver':
              file.ver = _git.ver2array(nval.replace(',','.'));  
              break;
            
            case 'notes':
              file.notes = [nval];
              break;
            
            case 'lock':
              file.lock = nval == 'true';
              if(file.lock) file.flags = flagLock(file.flags);
              else file.flags = flagUnlock(file.flags);
              break;                
            
            default:
              quit(`${key}: not yet implemented.`);
          }
          
          if(!(/U/).test(file.flags)) file.flags += 'U';
          
          //cl(file.path);
          touch(file.path);
          //exit();
          _git.exec(dir,{args:["add",file.name]},function(raw){
            _git.fileCommit($.source.path,file,function(){
              _git.push($.source.path,cb)
            })
          });

        },val.toString()) // new value        
      }) // select field
    });
  },_args[0]);  
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
  else if(isopt('all')) {
    if(_args[0]) return cb(_args[0]);
    return cb('auto-build-all');
  }
  else prompt('Enter Release Notes',cb,`${_uid.toUpperCase()} - `);    
}

// console main release func
function release(repo='target'){
  const src = source(repo);
  selectFiles(repo,function(files){
    //cl('[release]:1',files);
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
  //if(!$.pug.enabled) return quit('pug is disabled.')
  
  fn          = fn.replace($.pug.basedir,'');
  const fname = _path.basename(fn);
  const html  = _path.join($.source.path,$.pug.basedir);
  var fp      = _path.join(html,fn);
  
  if($.debug>1) cl(`[pugBuild]:\nfn:${fn}\nfname:${fname}\nhtml:${html}\nfp:${fp}\n`);

  /*
    [pugBuild]: 
    fn        : /vwltsa/sa_jobman.pug 
    fname     : sa_jobman.pug 
    html      : /usr/share/dev/nodejs/src/pure3/html/eui 
    fp        : /usr/share/dev/nodejs/src/pure3/html/eui/vwltsa/sa_jobman.pug

    [pugBuild]:
    fn        : mod/sales/email/asdf_billings.pug
    fname     : asdf_billings.pug
    html      : /usr/share/dev/nodejs/src/pure3/html/eui
    fp        : /usr/share/dev/nodejs/src/pure3/html/eui/mod/sales/email/asdf_billings.pug

  */
  
  // dont process email templates: mod/sales/email/asdf_billings.pug
  if((/^mod\//).test(fn)) {
    fp = _path.join($.source.path,fn);
    var src = _fs.readFileSync(fp,'utf-8');// .replace(/\\r/g,'').trim();//.replace(/\n/g, '\r\n');
    
    return cb({
      code  : src,
      warn  : true,
      error : false,
      msg   : `${fn} is not a html/eui/ file.`
    })
  }
  
  // read [fp] template.
  else {
    
    var src = _fs.readFileSync(fp,'utf-8').trim();
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
  }
  
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
    //if(_path.extname(file.name) == '.pug') code = `${code}\n\n//- ${comment}\n`;
    //else code = `/*${comment}*/\n${code}`;
    var extn = _path.extname(file.name); 
    if(extn != '.pug' && extn != '.sql') code = `/*${comment}*/\n${code}`;
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

    // Prompt for notes.
    function notes(){
      prompt(`Enter Notes`,function(notes){
        
        if(notes && !(/^$|^x$|^q$/).test(notes)) {
          file.notes = notes;
          _lastnote = notes;
        } 
        else quit('Notes are required.');
        
        commit();
      
      },file.notes[0] || _lastnote);  // prompt-notes 
    }
    
    // commit the file.
    function commit(){
      _git.fileCommit($.source.path,file,function(data){
        proc.push(file);
        next();
      });
    }
    
    // post file build & copy
    function done(min){
      
      // js/css compile error.
      if(min && min.error) {
        quit(min.msg)
      }
      
      // file.skipnotes
      if(file.skipnotes) {
        delete file.skipnotes;
        commit();
      }
      
      // prompt for notes.
      else notes();
    
    }
    
    file.flags = file.flags.replace('U','');  // remove Update (infoSet) flag.
    file.ver = _git.verInc(file.ver);         // increment version.
    var extn = _path.extname(file.name).replace(/^\./,'');
    const {sfn,rfn} = fns(file.name);
    dodir(rfn); // create folder if not exists.
    
    switch (extn){

      case 'sql':
        var sql = _fs.readFileSync(sfn,'utf-8');
        sql = sql.replace(/(\/\*[^*]*\*\/)|(\/\/[^*]*)|(\n.*--.*)/g,'');
        //sql = sql.replace(/^\s*\n/gm,''); // Blank Lines
        buildWrite(file,sql,done);
        break

      case 'js':
      case 'css':
        buildTry(file.name,function(build){
          if(build.error) return done(build);
          buildWrite(file,build.code,done); 
        });
        break;

      case 'jade':
      case 'pug':
        buildTry(file.name,function(build){
          if(build.error) return done(build);
          //cl(file,build.code);
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

// Binary build
function binSync(cb){
  var cmd =`/bin/bash ${$.binary.path}/private/sync;`;
  _git.shell(cmd,cb);       
}

// Binary Compile
function binCompile(cb){
  var cmd =`/bin/bash ${$.binary.path}/private/compile;`;
  _git.shell(cmd,cb);       
}

// Binary Release
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
    },_args[0]) 
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

// get and (true) increment the package version.
function binPack(inc){
  var packpath = _path.join($.binary.path,'package.json'); 
  var pack = require(packpath);
  if(inc) {
    pack.version = _git.verInc(pack.version);
    _fs.writeFileSync(packpath,JSON.stringify(pack,null,2));
  }  
  return pack.version;
}

// console binary builds
function conBinary(){

  $.binver = binPack();

  if((/^release/).test(_opts)) {
    release('binary');
  }

  else if((/^sync/).test(_opts)) {
    binSync(function(ok){
      cl(`${$.binver} Binary Files Sync Completed.`);    
    });     
  }

  else if((/^compile/).test(_opts)) {
    cl('This will take up to 1 minute.')
    prompt('Proceed ? [y/n]',function(yn){
      if(yn.toLowerCase()!='y') exit(); 
      cl('Please wait...');
      conLoading();
      binCompile(function(ok){
        cl(ok);
        conLoading(true);
        binPack(true);
        cl(`${$.binver} Binary COMPILE complete.`);   
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
  row('File Sync','puredev binary -sync')
  row('Compile Binary','puredev binary -compile')
  row('Github Release','puredev binary -release')
  
  h2('Modify Files')
  //row('Lock File','puredev lock dir/file')
  //row('Unlock File','puredev unlock dir/file')
  row('Delete File','puredev rm dir/file')
  row('Change Info','puredev infoSet dir/file')
  
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
function binLocals(list,files,cb){

  // list changed files & see if in locals.
  var bin, done=[], locs = []; files.map(function(file){

    // only return 1 file pure3-linux-a*; 
    if(1==2 && (/^pure3-linux-a*/).test(file.name)) {
      if(_uid == 'pac') {
        if(!bin) {
          file.name = 'pure3-linux-a*';
          locs.push(file.name);
        }
      }
    }
    
    if(list.indexOf(file.name)>-1) locs.push(file.name);
    else done.push(file);  
  });
  
  // get file-info from non-source path.
  if(locs.length) _git.infosGet($.binary.path,locs,function(infos){
    for(var k in infos){
      //infos[k].ver = _git.verInc(infos[k].ver); // increment version
      infos[k].ver = $.binver;
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

function touch(path){
  var oper = filePerm(path); 
  var bits = oper.split('');
  if(bits[1]=='7') bits[1]='6'; else bits[1]='7';
  var nper = bits.join(''); 
  _fs.chmodSync(path,nper);
  return {old:oper,new:nper};   
}

if(_uid=='pac'){

  // ce('xxx','yyy'); process.exit();

  //var file = _path.join(__dirname,'puredev.js'); 
  //cl(touch(file));
  //exit();

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
    _git.changedFiles($.source.path,$.source.info);
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
    infoSet();
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

/*
  case 'lock':
    conLock();
    break;

  case 'unlock':
    conUnlock();
    break;
*/
  
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

