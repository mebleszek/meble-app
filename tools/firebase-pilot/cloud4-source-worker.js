// Dedicated, isolated synthetic realm: no Firebase, page Storage, UI or data upload.
importScripts('./cloud4-synthetic-source.js');
const fixture=CLOUD4SyntheticSource;
self.window=self;self.Date=fixture.FixedDate;self.Storage=fixture.MemoryStorage;
self.localStorage=new fixture.MemoryStorage();self.sessionStorage=new fixture.MemoryStorage();
self.FC={utils:{clone:v=>JSON.parse(JSON.stringify(v))},infoBox:{open(){throw Error('CLOUD4_SOURCE_UI_FORBIDDEN');}}};
importScripts(...fixture.files.map(f=>'../../js/app/'+f+'.js'));
const source=fixture.create(FC,localStorage,sessionStorage,self);
self.onmessage=async event=>{
 const {id,options}=event.data||{};
 try{self.postMessage({id,result:await source.build(options)});}
 catch(_){self.postMessage({id,result:{ok:false,code:'CLOUD4_SOURCE_REFUSED',path:'source'}});}
};
