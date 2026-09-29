"""Two real HTTP sessions and one spectator; creates only local test rooms."""
import concurrent.futures, http.cookiejar, json, time, urllib.request, urllib.error, uuid
BASE='http://127.0.0.1:4179'
class Client:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar();self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def call(self,path,data=None):
  req=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':BASE})
  try:
   with self.http.open(req,timeout=20) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
a,b,watcher=Client(),Client(),Client()
status,s=a.call('/api/rooms',{'name':'Chat Alice','character':'Violent J'});assert status==201,s
path='/api/rooms/'+s['code'];alice=s['me']
status,s=b.call(path,{'name':'Chat Bob','character':'Mack Benjamin'});assert status==200,s
rev=s['rev'];payload={'id':str(uuid.uuid4()),'text':'Hello, table!','senderName':'Imposter','senderId':'fake'}
assert watcher.call(path+'/chat')[0]==403
assert watcher.call(path+'/chat',payload)[0]==403
with concurrent.futures.ThreadPoolExecutor(2) as pool:
 results=list(pool.map(lambda pair:pair[0].call(path+'/chat',pair[1]),[(a,payload),(b,{'id':str(uuid.uuid4()),'text':'Hi Alice'})]))
assert all(status==200 for status,_ in results),results
status,h=a.call(path+'/chat');assert status==200 and len(h['messages'])==2,h
m=next(m for m in h['messages'] if m['id']==payload['id']);assert m['senderName']=='Chat Alice' and m['senderId']==alice
assert a.call(path)[1]['rev']==rev
assert a.call(path+'/chat',payload)[0]==200
assert len(b.call(path+'/chat')[1]['messages'])==2
assert a.call(path+'/chat',{'id':str(uuid.uuid4()),'text':'too soon'})[0]==429
assert a.call(path+'/chat',{'id':str(uuid.uuid4()),'text':'x'*501})[0]==400
reconnect=Client();reconnect.jar=a.jar;reconnect.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(reconnect.jar))
assert reconnect.call(path+'/chat')[1]['messages']==h['messages']
assert all('session' not in m for m in h['messages'])
print(json.dumps({'room':s['code'],'connection':h['connection'],'checks':['two independent authors','spectator denied','author spoof rejected','simultaneous send','retry idempotency','rate limit','length limit','reconnect','game revision unchanged'],'result':'passed'}))
