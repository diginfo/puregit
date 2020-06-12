#!/usr/bin/env node

const exit = process.exit;

// Logging
const ce = console.error;
const cl = console.log;
const jl = function(obj,str){
  str=str||'';
  try {cl(str,JSON.stringify(obj))}
  catch(e){cl(e)};
}

const _cp     = require('child_process');
const _path   = require('path');
const fs      = require('fs');
const async   = require('async');
const _uid    = process.env.UID3;

module.exports = {
  
  dryrun         : true,
  
  /* Utils */
  shell          : exec,
  exec           : git_exec,
  changedFiles   : changedFiles,
  deletedAdd     : deletedAdd,
  verInc         : verInc,
  filedata       : filedata,
  infoParse      : infoParse,
  locked         : locked,
  
  /* File */
  infoGet        : infoGet,
  infosGet       : infosGet,  
  fileAdd        : fileAdd,
  filePublish    : filePublish,
  fileInc        : fileInc,
  fileCommit     : fileCommit,
  fileRm         : fileRm,
  revert         : revert,
  
  /* Global */
  push           : push,
  status         : status
}

const mex = module.exports;

// $ Globals
if(!global.$) global.$ = {};
$.gitignore = $.gitignore || [];

function newrl(){
  return readline.createInterface({input: process.stdin,output: process.stdout}); 
}

function errors(msg){
  if((/path not in the working tree|not match any file\(s\) known to git/).test(msg)) return 'file not found.';
  if((/is not a git command/).test(msg)) return 'invalid command.';
  return msg;
}

function exec(cmd,cb){
	var opts = { maxBuffer: 10 * 1024 * 1024 * 1024};
	//var opts = {};
	_cp.exec(cmd,opts,function (error, stdout, stderr) {
		if(typeof(cb)=="function") {
			if(error){ return cb({error:true,'err':error,'std':stderr,'msg':stderr});}
			else return cb(stdout);
		} else return null;
	});
};

function revert(dir,file,cb){
  git_exec(dir,{args:["revert",file.hash]},function(){
    fileCommit(dir,file,cb)    
  });  
}

function git_exec(dir,qry,cb){
  process.chdir(dir);
  var cmd = ["git"];
  //if($.debug > 1) cmd.unshift('--dry-run');
  qry.args.map(function(arg){cmd.push("'"+arg+"'")});  
  cmd = cmd.join(' ').replace(/'/g,'');
  if($.debug > 1) cl(`gitExec(): ${dir} > ${cmd}`); 
  exec(cmd,function(res){
    if(!cb) return null;
    else if(res.error) cb({error:true,msg:errors(res.msg)});
    else cb(res.replace(/\t/g,' ').split('\n').filter(function(e){return e}));  
  })
}

function filedata(args={}){
 return Object.assign({
    stat    : '',
    flags   : '',
    name    : '',
    ver     : $.version,
    uid     : _uid,
    notes   : '',
    hash    : '',
    error   : false,
    data    : ''
  },args)
}

function deletedAdd(dir,cb=cl){
  git_exec(dir,{args:["ls-files","--deleted","|","xargs","git","add"]},cb);
}

/*
function verInc(ver){
  ver = ver.toString();
  var bits = ver.split('.');
  if(bits.length==1) bits[1]=0;
  bits[1] ++;
  return (bits.join('.')); 
}
*/

function verInc(ver){
  ver[0] = ver[0] || $.version;
  ver[1] = ver[1] || 0;
  ver[1] ++;
  return ver;
}

// pushes all changes
function push(dir,cb=cl){
  git_exec(dir,{args:["log","origin/master..HEAD"]},function(raw){
    if(!raw || !raw.length) {
      if($.debug > 0) cl('Nothing to push.');
      return cb();
    }
    if($.debug > 0) cl('Pushing changes...');
    git_exec(dir,{args:["push","-u","--force","origin","master"]},function(res){
      if(cb) cb(res);
    })
  })         
}

// file:{name,notes,ver,flags}
function fileAdd(dir,file,cb=cl){
  git_exec(dir,{args:["add",file.name]},function(res){
    if($.debug > 1) cl('fileAdd()',file);
    if(cb) cb(res);
  })         
}

// file:{name,notes,ver,flags} (increment ??);
function filePublish(dir,file,cb=cl){
  fileAdd(dir,file,function(ok){
    if($.debug > 1) cl('filePublish()',file);
    fileCommit(dir,file,function(ok){
      push(dir,cb);  
    })
  })  
}

function fileInc(dir,fn,cb=cl){
dir = $.source.path;
  infoGet(dir,fn,function(data){
    data.ver = verInc(data.ver);
    if(cb) return cb(data);
    cl(data)  
  })
}

function notes2array(data){
  if(Array.isArray(data)) return data;
  return data.replace(/\|/g,':').split(/\n/); 
}

function notes2str(data){
  if(!Array.isArray(data)) data=[data];
  return data.join(';').replace(/\|/g,':').replace(/"|'/g,'');
}

// Convert 3.99 > [3,99]
function ver2array(data){
  if(Array.isArray(data)) return data;
  var [maj,min] = data.toString().split('.');
  maj=parseInt(maj||$.version);min=parseInt(min||'0'); 
  return[maj,min];    
}

function ver2str(data){
  return ver2array(data).join('.');  
}

// file:{name|ver|uid|flags|notes} (70chrs ??)
function fileCommit(dir,file,cb=cl){

  var notes = [
    file.name,
    ver2str(file.ver || []),
    _uid,
    file.flags,
    notes2str(file.notes || '')
  ].join('|')
  
  if($.debug > 1) cl('fileCommit():',notes);
  var args = ["commit","-o",file.name,"-m",`"${notes}"`];
  
  // mainly used by lock/unnlock
  if(file.force) args.push("--amend");
  delete(file.force);
  
  git_exec(dir,{args:args},function(res){
    if(cb) cb(res);
    else cl(res);
  })
}

// file:{name,notes,ver,flags}
function fileRm(dir,file,cb){
  git_exec(dir,{args:["add",file.name,";","rm","-rf",file.name]},function(res){
    fileCommit(dir,file,cb);
  });        
}

function fileMv(dir,file,cb){
  if(!file.oname) return cb({error:true,msg:'no oldfile name.'})
  file.notes = `renamed ${file.oname} > ${file.name}`
  git_exec(dir,{args:["add",file.name,";","mv","-f",file.oname,file.name]},function(res){
    fileCommit(dir,file,cb);
  });        
}

// this function receives all file statuses.
function ___filesRmMv(dir,files,cb=cl){
  if(_uid=='pac') return pac_filesRmMv(dir,files,cb);
  
  var idx = 0;
  
  /*
    Modified,Added,Deleted,Renamed,Copied,Updated
    { stat: 'D', name: 'file1.txt' }
    { stat: 'R', name: 'file2b.css', oname: 'file2a.css' }
  */
  
  var fns = files.filter(function(file){
    if((/D|R/).test(file.stat)) return file.name;
  });
  
  infosGet(dir,fns,function(infos){
    async.eachSeries(files,function(file,next){
      
      // jl(file);
      if((/D/).test(file.stat)){
        cl('deleting',file.name);
        // remove & commit from run / target
        fileRm($.target.path,file,function(rm){
          // commit source ??
          fileCommit($.source.path,file,function(com){
            files.splice(idx,1);
            next();  
          }) 
        });
      }
  
      else if((/R/).test(file.stat)){
        cl(`renaming ${file.oname} > ${file.name}`);
        // move target
        fileMv($.target.path,file,function(mv){
          // commit source
          fileCommit($.source.path,file,function(com){
            files.splice(idx,1);
            next();  
          }) 
        })
      }
      
      else next();    
      
    },function(){
      cb(files);  
    });
  
  })  //infosGet
}

// TODO: paths are not right.
function filesRmMv(dir,files,cb=cl){
  var idx = 0;
  
  /*
    Modified,Added,Deleted,Renamed,Copied,Updated
    { stat: 'D', name: 'file1.txt' }
    { stat: 'R', name: 'file2b.css', oname: 'file2a.css' }
  */
  
  var fns = []; files.map(function(file){
    //cl(file); // { stat: 'D', name: 'html/eui/inv/js/bhave.js' }
    if((/D|R/).test(file.stat)) fns.push(file.name);
  });
  
  infosGet(dir,fns,function(infos){
    async.eachSeries(files,function(file,next){
      var done = false;
      if(!file) return next();

      function del(lcb){
        if(!(/D/).test(file.stat)) return lcb()
        cl(`Deleting' ${file.name}`);
        fileRm($.source.path,file,function(rm){
          fileRm($.target.path,file,function(rm){
            files.splice(idx,1);
            lcb() 
          }) 
        });
      }
 
      function ren(lcb){
        if(!(/R/).test(file.stat)) return lcb();
        cl(`Renaming ${file.oname} > ${file.name}`);
        fileMv($.source.path,file,function(mv){
          fileMv($.target.path,file,function(mv){
            files.splice(idx,1);
            lcb(); 
          }) 
        })
      }
      
      // delete, then rename, then next.
      del(function(){
        ren(function(){
          next();
        });
      });  
      
    },function(){
      cb(files);  
    });
  
  })  //infosGet
}

/*
  git status only show un-committed.
  returns [{name,stat:'AMD?'}]
  test.css -> xtest.css
*/
function status(dir,cb=cl){
  const files = [];
  git_exec(dir,{args:["add","-A"]},function(raw){
    git_exec(dir,{args:["status","-s"]},function(raw){
      async.eachSeries(raw,function(row,next){
        try {
          const data = {};
          [_,data.stat,data.name] = row.match(/^(.{1,3})\s+(.*)/);
          data.stat = data.stat.trim().slice(-1); // ONLY LAST.
          // Modified,Added,Deleted,Renamed,Copied,Updated
          
          // Moved/Renamed.
          var bits = (data.name).match(/(.*)\s->\s(.*)/); 
          if(data.stat=='R' && bits){
            data.oname = bits[1]
            data.name = bits[2];
          }
          
          files.push(data);
          next();
        } catch(err){
          cl(err);
          next();
        };
      },function(){
        filesRmMv(dir,files,cb);
      });      
    })
  })  
}

// returns [array] of file objects
function changedFiles(dir,cb=cl){
  const files=[];
  status(dir,function(stats){
    //cl('stats>',stats); // [ { stat: 'A', name: 'file.js' } ]
    async.eachSeries(stats,function(stat,next){
      //cl('stat.name>',stat.name);
      if($.gitignore.indexOf(stat.name)>-1) return next();     
      infoGet(dir,stat.name,function(info){
        //cl('changedFile:',info);
        info.stat = stat.stat;
        files.push(info);
        if(stat.oname) {  // if file has been renamed.
          info.notes = 'deleted/renamed';
          info.ver = $.version;
        }
        next();
      }); 
    },function(){
      return cb(files);
    });
  });
}

function infoParse(raw){
  var data = {
    name  : '',
    notes : '',
    ver   : $.version,
    uid   : '---',
    data  : raw||'',
    flags : '',
    lock  : false,
    rels  : {},
    error : false
  };
  
  if(!raw) return data;
  
  // Get hash and commit message.
  var bits = raw.match(/(^[0-9a-fA-F]{7})\s+(.*)/);
  if(!bits) return data;
  [_,data.hash,data.data] = bits;
  
  // OLD: file-path, ver, uid, notes.
  var bits = data.data.match(/^(.*),\s+ver:([0-9.]+),\s+uid:(.{3})\s+(.*)/);
  if(bits && bits.length > 4) [_,data.name,data.ver,data.uid,data.notes] = bits;
  
  else {
    // NEW: 
    var bits = data.data.split('|');
    if(bits.length > 3) {
      // name|ver|uid|flags|notes
      if(bits.length == 5) [data.name,data.ver,data.uid,data.flags,data.notes] = bits;
      
      // ver|uid|flags|notes
      else [data.ver,data.uid,data.flags,data.notes] = bits;
    }
    
    // No Tracking Info
    else {
      data.notes = 'no-data';
      data.error = true; 
    }
  }
  
  data.lock = (/L/).test(data.flags);
  data.ver = ver2array(data.ver); 
  data.notes = notes2array(data.notes);
  
  return data;    
}

// get last commit for one file. {name,ver}
function infoGet(dir,fn,cb=cl){
  var cmd = ["log","origin/master","--oneline",`--grep="${fn}"`,"|","grep","-m1",'""'];
  git_exec(dir,{args:cmd},function(list){
    var info = infoParse(list[0]);
    info.name = fn; 
    cb(info);
  })
}

// get last commit multiple files {xx:{name:ver},yy:{name,ver}}
function infosGet(dir,fns,cb=cl){
  if(!Array.isArray(fns)) fns=[fns];
  var files = {};
  async.eachSeries(fns,function(fn,next){  
    infoGet(dir,fn,function(info){
      files[info.name] = info;  
      next();
    })
  },function(){
    cb(files);
  })   
  
}

function locked(cb=cl){
dir=$.source.path; 
  git_exec(dir,{args:["log",'--grep="|L|"',"--oneline"]},function(list){
    var files = [];
    list.map(function(file){
      var info = infoParse(file);
      if(files.indexOf(info.name)<0) files.push(info.name);
    })   
    cb(files);
  });
}

function remoteDiff(qry,cb=cl){
  /*
    skips.json, gitdata.json not used.  
  */
  
  // Main Code.
  sqlfiles(function(sqls){
    git_exec({args:["fetch","origin","&&","git","diff","origin/master","--name-only"]},function(list){
      list = list.concat(sqls); 
      if($.runmode == 'pkg') list.push('pure3-linux-a*');
      ['data/gitdata.json'].map(function(file){list.splice(file,1)})
      
      git_exec({args:["log","origin/master","--oneline","--",list.join(' ')]},function(info){  
      
        var files={},purebin;
        info.map(function(e){
          e = e.trim();
          if(!e) return;
          var data = parse(e);
          if(data.name){
            
            // handle purebin files.
            // $.isdev = false; $.runmode='default';
            if ($.isdev || $.runmode == 'pkg'){
              if ((/^pure3-linux-a./).test(data.name) && !purebin ){
                purebin = true;
                data.name = 'pure3-linux';
              }
              // sql files and reports only.
              else if(!(/^sql\/.*\.sql|^prpt\/.*\.prpt/).test(data.name)) return;
            }

            if(list.indexOf(data.name) < 0) return;
            if(!(data.name in files)){files[data.name] = data}
            
            else if( (data.ver[0] >= files[data.name].ver[0]) && (data.ver[1] > files[data.name].ver[1]) ){
              files[data.name].ver    = data.ver;
              files[data.name].hash   = data.hash;
              files[data.name].notes  = data.notes;
              files[data.name].data   = data.data;               
            }
            
            files[data.name].rels[data.ver.join('.')] = {hash:data.hash,notes:data.notes};
          }
          
        })
  
        var ups=[];
        for(var k in files) ups.push(files[k]);
        return cb(ups);
      })    
    })
  })
}


