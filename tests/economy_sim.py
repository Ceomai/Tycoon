# Aktif oyuncu simülasyonu: her saniye toplar, en iyi geri dönüşlü (maliyet/gelir artışı) yatırımı yapar.
T={'ev':(100,1,20,0),'kafe':(1500,9,90,1000),'dukkan':(20000,80,300,15000),'ofis':(250000,700,900,200000)}
LV=[0,1,2.5,6,14,32]; UC=[0,2,5,12,30]; UT=[0,2,4,8,16]
def run(boost=False, adj=1.3, horizon=6*3600):
    cash=150; earned=0; plots=[]  # dict t,lvl,until
    t=0; marks={}
    while t<horizon:
        inc=sum(T[p['t']][1]*LV[p['lvl']]*adj for p in plots if p['lvl']>0 and p['until']<=t)
        g=inc*(2 if boost else 1); cash+=g; earned+=g
        for p in plots:
            if p['until'] and p['until']<=t and p['up']: p['lvl']+=1; p['up']=False; p['until']=0
            elif p['until'] and p['until']<=t and p['lvl']==0: p['lvl']=1; p['until']=0
        for k,(c,i,tm,u) in T.items():
            if earned>=u and k not in marks: marks[k]=t
        # options
        best=None
        if len(plots)<20:
            for k,(c,i,tm,u) in T.items():
                if earned<u: continue
                n=sum(1 for p in plots if p['t']==k); cost=c*1.12**n
                roi=cost/(i*adj)+tm*(1+.1*n)
                if best is None or roi<best[0]: best=(roi,cost,'b',k,tm*(1+.1*n))
        for p in plots:
            if p['lvl']>=1 and p['lvl']<5 and not p['until']:
                c,i,tm,u=T[p['t']]; cost=c*UC[p['lvl']]; d=i*(LV[p['lvl']+1]-LV[p['lvl']])*adj
                roi=cost/d+tm*UT[p['lvl']]
                if best is None or roi<best[0]: best=(roi,cost,'u',p,tm*UT[p['lvl']])
        if best and cash>=best[1]:
            cash-=best[1]
            if best[2]=='b': plots.append({'t':best[3],'lvl':0,'until':t+best[4],'up':False})
            else: best[3]['until']=t+best[4]; best[3]['up']=True
        if len(plots)==20 and all(p['lvl']>0 for p in plots) and 'full' not in marks: marks['full']=t
        if 'full' in marks and cash>=150000 and 'besiktas' not in marks: marks['besiktas']=t
        t+=1
    return {k:f"{v/60:.1f} dk" for k,v in marks.items()}, f"gelir/sn sonunda {inc:.0f}"
print('reklamsız', run(False))
print('sürekli 2x', run(True))
