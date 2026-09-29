"""Local-only persisted HTTP scenarios. Run against the development server on 4179.
Fixtures modify only rooms created by this process, never existing user rooms.
"""
import concurrent.futures, http.cookiejar, json, sqlite3, time, urllib.request, urllib.error
from pathlib import Path
BASE='http://127.0.0.1:4179'
root=Path(__file__).resolve().parents[1]
dbs=[p for p in (root/'.wrangler/state/v3/d1').rglob('*.sqlite') if p.name!='metadata.sqlite']
assert len(dbs)==1,'Start the local dev server with its local D1 binding first.'
cards={c['key']:c for c in json.loads((root/'lib/rules/cards.json').read_text())}
created=set()
class Client:
 def __init__(self):
  self.jar=http.cookiejar.CookieJar()
  self.http=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
 def call(self,path,data=None):
  req=urllib.request.Request(BASE+path,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json','Origin':BASE})
  try:
   with self.http.open(req,timeout=20) as r:return r.status,json.load(r)
  except urllib.error.HTTPError as e:return e.code,json.load(e)
def fixture(code,fn):
 assert code in created
 with sqlite3.connect(dbs[0],timeout=10) as db:
  raw,rev=db.execute('SELECT state, revision FROM rooms WHERE code=?',(code,)).fetchone()
  s=json.loads(raw);assert all(p['name'].startswith('Integration ') for p in s['players'])
  fn(s);s['rev']=rev+1
  assert db.execute('UPDATE rooms SET state=?,revision=? WHERE code=? AND revision=?',(json.dumps(s),rev+1,code,rev)).rowcount==1
 return s
def take(s,p,name):
 for group in [*s['decks'],*s['discards'],s['purchase'],s['boneDeck'],s['boneDiscard']]:
  for id in group:
   if cards[id.split('@')[0]]['name']==name:
    group.remove(id);p['items'].append(id);return id
 raise AssertionError(name)
def arrange_bone(s,name):
 id=next(id for id in s['boneDeck'] if cards[id.split('@')[0]]['name']==name)
 s['boneDeck'].remove(id);s['boneDeck'].append(id)
 s.update(phase='roll',ruling=None,encounter=None,combat=None,queue=[],choices=[],overflow=None,decision=None)
for count in [2,6]:
 cs=[Client() for _ in range(count)];watcher=Client()
 names=['Killnor','Violent J','Mack Benjamin','Double A','Blaze','Squeezy']
 status,s=cs[0].call('/api/rooms',{'name':'Integration 0','character':names[0]});assert status==201,s
 code=s['code'];created.add(code);path='/api/rooms/'+code
 for i in range(1,count):
  status,s=cs[i].call(path,{'name':f'Integration {i}','character':names[i]});assert status==200,s
  status,s=cs[i].call(path+'/action',{'type':'ready','version':s['rev']});assert status==200,s
 status,s=cs[0].call(path+'/action',{'type':'start','version':s['rev']});assert status==200,s
 ids=[p['id'] for p in s['players']];active=s['turn'];actor=ids[active]
 def read(i=active):
  status,s=cs[i].call(path);assert status==200,s;return s
 def action(i,**a):
  state=read(i);status,result=cs[i].call(path+'/action',dict(a,version=state['rev']));assert status==200,result;return result
 status,v=watcher.call(path);assert status==200 and v['me'] is None and v['ending'] is None
 assert not any(k in v for k in ['decks','boneDeck','endingPool']) and all('session' not in p for p in v['players'])
 assert watcher.call(path+'/action',{'type':'roll','version':s['rev']})[0]==403
 assert cs[(active+1)%count].call(path+'/action',{'type':'roll','version':s['rev']})[0]==400
 with concurrent.futures.ThreadPoolExecutor(2) as pool:
  raced=list(pool.map(lambda _:cs[active].call(path+'/action',{'type':'roll','version':s['rev']}),range(2)))
 assert sorted(status for status,_ in raced)==[200,409],raced
 s=read();d=s['choices'][0];s=action(active,type='move',region=d['region'],pos=d['pos'])
 assert s['phase']=='encounter'
 # Persisted control transfer and reconnect from independent sessions.
 fixture(code,lambda s:arrange_bone(s,'Skitsofrantic'))
 action(active,type='table-rule',reason='Integration source effect')
 s=action(active,type='ruling-adjust',stat='draw',deck='bone',reason='Integration Bone effect')
 controller=(active+1)%count
 assert read(controller)['control']==actor
 assert cs[active].call(path+'/action',{'type':'ruling-finish','actor':actor,'version':s['rev']})[0]==400
 action(controller,type='ruling-finish',actor=actor,choice='leave')
 s=action(controller,type='roll',actor=actor);assert s['phase']=='move'
 # Expire the condition via actual turn endings, keeping fixtures for board position only.
 for _ in range(count*2+1):
  current=read()['turn'];v=read(current);owner=ids.index(v['players'][current]['controller'])
  fixture(code,lambda s:s.update(phase='end',ruling=None,encounter=None,queue=[],choices=[]))
  s=action(owner,type='end',actor=ids[current])
 assert s['players'][active]['controller']==actor
 # Draw the timed absence on its holder's turn and resume after a persisted expiry.
 fixture(code,lambda s:(s.update(turn=active),arrange_bone(s,'King High Bone')))
 action(active,type='table-rule',reason='Integration timed Bone')
 s=action(active,type='ruling-adjust',stat='draw',deck='bone',reason='Integration Bone effect')
 assert s['players'][active]['absentUntil']>time.time()*1000+590000
 assert s['phase']=='end' and s['ruling'] is None
 s=action(active,type='end');assert s['turn']!=active
 fixture(code,lambda s:s['players'][active].update(absentUntil=int(time.time()*1000)-1))
 before=read()['rev'];s=read();assert 'absentUntil' not in s['players'][active] and s['rev']==before
 # Casket preserves inventory and leaves the next player a legal turn.
 def casket_fixture(s):
  s.update(turn=active,phase='roll',ruling=None,encounter=None,queue=[],choices=[])
  take(s,s['players'][active],'Casket')
 fixture(code,casket_fixture);before=read()['players'][active]
 action(active,type='table-rule',reason='Integration lethal effect')
 s=action(active,type='ruling-adjust',stat='life',amount=-20,reason='Integration lethal effect')
 p=s['players'][active];assert p['life']==1 and p['character']==before['character'] and p['items']==before['items'] and p['cash']==before['cash']
 action(active,type='ruling-finish',choice='leave');action(active,type='end')
 for _ in range(count-1):
  current=read()['turn'];fixture(code,lambda s:s.update(phase='end',ruling=None,encounter=None,queue=[],choices=[]))
  action(current,type='end')
 p=read()['players'][active];assert (p['region'],p['pos'])==(0,9) and 'casketRecovery' not in p
 # Scripted ending: enter, delay a lethal outcome, replace it and persist a winner.
 def ending_fixture(s):
  s.update(turn=active,phase='move',choices=[{'region':3,'pos':0,'toll':0}],ending='dimension',endingPool=['unveiling'],finalRevealed=False,finalEntered=False)
  p=s['players'][active];p.update(region=2,pos=6,bonus=15);take(s,p,'Psychopathic Ring')
 fixture(code,ending_fixture)
 s=action(active,type='move',region=3,pos=0);assert s['endingPending']==actor and not s['players'][active]['dead']
 s=action(active,type='ending-replace');assert s['status']=='finished' and s['winner']==actor
 for i in range(count):
  v=read(i);assert v['me']==ids[i] and v['winner']==actor and v['rev']==s['rev']
 assert watcher.call(path)[1]['winner']==actor
 print(json.dumps({'seats':count,'room':code,'result':'passed','checks':['independent sessions','private state','concurrent conflict','movement','delegated control','turn-based expiry','real-time expiry','Casket recovery','Ring replacement','persisted victory']}))
