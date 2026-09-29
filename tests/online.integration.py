"""Exercise room join and turn conflict through the configured local storage backend."""
import concurrent.futures, http.cookiejar, json, urllib.request, urllib.error
BASE='http://127.0.0.1:4179'
class Client:
 def __init__(self): self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def call(self,path,data=None):
  request=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':BASE})
  try:
   with self.http.open(request,timeout=20) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
for count in [2,6]:
 clients=[Client() for _ in range(count)];watcher=Client()
 names=['Killnor','Violent J','Mack Benjamin','Double A','Blaze','Squeezy']
 status,s=clients[0].call('/api/rooms',{'name':'Online 0','character':names[0]});assert status==201,s
 path='/api/rooms/'+s['code']
 for i in range(1,count):
  status,s=clients[i].call(path,{'name':f'Online {i}','character':names[i]});assert status==200,s
  status,s=clients[i].call(path+'/action',{'type':'ready','version':s['rev']});assert status==200,s
 status,s=clients[0].call(path+'/action',{'type':'start','version':s['rev']});assert status==200,s
 public=watcher.call(path)[1];assert public['me'] is None
 assert not any(k in public for k in ['decks','boneDeck','endingPool','flow'])
 assert all('session' not in p for p in public['players'])
 active=clients[s['turn']];rev=s['rev']
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  results=list(pool.map(lambda _:active.call(path+'/action',{'type':'roll','version':rev}),range(2)))
 assert sorted(status for status,_ in results)==[200,409],results
 status,s=active.call(path);assert status==200 and s['phase']=='move',s
 d=s['choices'][0]
 status,s=active.call(path+'/action',{'type':'move','region':d['region'],'pos':d['pos'],'version':s['rev']});assert status==200,s
 for c in clients:
  status,view=c.call(path);assert status==200 and view['rev']==s['rev'] and view['me'] is not None
 print(json.dumps({'players':count,'room':s['code'],'result':'passed','checks':['join','ready','start','private state','turn race','movement','all players synchronized']}))
