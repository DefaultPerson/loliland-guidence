#!/usr/bin/env python3
import gzip, struct, sys, json

class R:
    def __init__(self, d): self.d=d; self.i=0
    def u1(self): v=self.d[self.i]; self.i+=1; return v
    def i1(self): v=struct.unpack_from('>b',self.d,self.i)[0]; self.i+=1; return v
    def u2(self): v=struct.unpack_from('>H',self.d,self.i)[0]; self.i+=2; return v
    def i2(self): v=struct.unpack_from('>h',self.d,self.i)[0]; self.i+=2; return v
    def i4(self): v=struct.unpack_from('>i',self.d,self.i)[0]; self.i+=4; return v
    def i8(self): v=struct.unpack_from('>q',self.d,self.i)[0]; self.i+=8; return v
    def f4(self): v=struct.unpack_from('>f',self.d,self.i)[0]; self.i+=4; return v
    def f8(self): v=struct.unpack_from('>d',self.d,self.i)[0]; self.i+=8; return v
    def s(self):
        n=self.u2(); b=self.d[self.i:self.i+n]; self.i+=n
        try: return b.decode('utf-8')
        except: return b.decode('latin1')

def payload(r,t):
    if t==1: return r.i1()
    if t==2: return r.i2()
    if t==3: return r.i4()
    if t==4: return r.i8()
    if t==5: return r.f4()
    if t==6: return r.f8()
    if t==7:
        n=r.i4(); v=r.d[r.i:r.i+n]; r.i+=n; return list(v)
    if t==8: return r.s()
    if t==9:
        et=r.u1(); n=r.i4(); return [payload(r,et) for _ in range(n)]
    if t==10:
        o={}
        while True:
            tt=r.u1()
            if tt==0: break
            nm=r.s(); o[nm]=payload(r,tt)
        return o
    if t==11:
        n=r.i4(); return [r.i4() for _ in range(n)]
    raise ValueError("tag %d @ %d"%(t,r.i))

def parse(path):
    raw=open(path,'rb').read()
    if raw[:2]==b'\x1f\x8b': raw=gzip.decompress(raw)
    r=R(raw); t=r.u1(); name=r.s(); return {name: payload(r,t)}

if __name__=='__main__':
    root=parse(sys.argv[1])
    # find FML ItemData anywhere
    def walk(o,path=''):
        if isinstance(o,dict):
            for k,v in o.items(): yield from walk(v,path+'/'+k)
        elif isinstance(o,list):
            yield (path,o)
    target=int(sys.argv[2]) if len(sys.argv)>2 else None
    fml=None
    def find_fml(o):
        if isinstance(o,dict):
            if 'ItemData' in o and isinstance(o['ItemData'],list): return o['ItemData']
            for v in o.values():
                f=find_fml(v)
                if f: return f
        return None
    items=find_fml(root) or []
    print("FML ItemData entries:",len(items))
    # entries: {'K': name, 'V': id}  (K may have a leading control byte)
    idmap={}
    for e in items:
        if isinstance(e,dict) and 'K' in e and 'V' in e:
            nm=e['K']; idv=e['V']
            # strip leading non-printable prefix
            nm2=''.join(ch for ch in nm if ch.isprintable())
            idmap[idv]=nm2
    json.dump(idmap, open('/home/def/projects/misc/loliland-guidence/data/idmap.json','w',encoding='utf-8'), ensure_ascii=False)
    if target is not None:
        print(f"\nid {target} -> {idmap.get(target, '??? (нет в локальном реестре)')}")
        print("neighbors:")
        for i in range(target-3,target+4):
            if i in idmap: print(f"  {i}: {idmap[i]}")
