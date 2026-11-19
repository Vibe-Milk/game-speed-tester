(() => {
  "use strict";
  const finite = Number.isFinite, states = Object.freeze(["OFF","PAUSED","SEARCH","APPROACH","COMBAT","LOOT","RECOVERY","DEAD","WAITING_FOR_DATA"]);
  const sessions = new WeakMap(), activation = new WeakMap(), activeScenes = new Set(), statsKey = "gst:custom-farm-stats:v1";
  const sceneNow = () => window.game?.scene?.getScene?.("world") ?? (window.__ntkScene?.sys?.settings?.key === "world" ? window.__ntkScene : null);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  function note(s, text) { s.message = text; }
  function release(s) {
    const {scene,auto} = s;
    const otherOwner = [globalThis.GSTHarvest,globalThis.GSTFarmBossSafety,globalThis.GSTFarmDefense,
      globalThis.GSTMapTravel,globalThis.GSTQuest,globalThis.GSTFarmSeals,globalThis.GSTRealm,globalThis.GSTChest]
      .some((owner)=>{try{return owner?.controls?.(scene)===true;}catch{return false;}});
    if (scene?.auto === auto && !otherOwner && s.steer && scene.autoX === s.steer[0] && scene.autoY === s.steer[1]) scene.autoX = scene.autoY = 0;
    s.steer = null; s.path=[];
    try { globalThis.GSTNavigation?.cancel?.(scene,s); globalThis.GSTNavigation?.resetLeg?.(s); } catch {}
  }
  function transition(s, state, message) {
    if (!states.includes(state)) state = "WAITING_FOR_DATA";
    if (s.state !== state) { s.state = state; s.stateAt = performance.now(); }
    if (message) note(s, message);
  }
  function identity(settings, scene, host) {
    let map = ""; try { map = host.mapKey?.() ?? ""; } catch {}
    return [settings.accountProfileKey || "unscoped", settings.accountId || "",
      settings.characterId || "", settings.classId || "", map].join("|");
  }
  function stat(s, key, delta) {
    if (!s.statsEnabled || !s.stats) return;
    const n = s.stats[key];
    if (finite(n)) s.stats[key] = clamp(n + delta, 0, 86400000);
  }
  function loadStats(identityKey) {
    try {
      const value=JSON.parse(sessionStorage.getItem(statsKey)||"null");
      if(value?.v!==1||value.identity!==identityKey||!value.stats)return null;
      const stats={};
      for(const key of ["elapsed","paused","stuck"]) stats[key]=finite(value.stats[key])?clamp(value.stats[key],0,86400000):0;
      for(const key of ["observedDeaths","observedKills"]) stats[key]=Number.isSafeInteger(value.stats[key])?clamp(value.stats[key],0,100000):0;
      return stats;
    } catch { return null; }
  }
  function saveStats(s) {
    if (!s.statsEnabled || !s.stats) return;
    try { sessionStorage.setItem(statsKey, JSON.stringify({v:1, identity:s.identity, stats:{...s.stats}, elapsed:s.stats.elapsed,
      paused:s.stats.paused, stuck:s.stats.stuck, observedDeaths:s.stats.observedDeaths,
      observedKills:s.stats.observedKills, xpPerMinute:null, potions:null, at:Date.now()})); } catch {}
  }
  function cleanup(scene) {
    const s=sessions.get(scene); if (!s) return;
    activation.set(scene,false); release(s); saveStats(s); s.removeUpdate?.();
    scene.events?.off?.("shutdown",s.cleanup); scene.events?.off?.("destroy",s.cleanup);
    sessions.delete(scene); activeScenes.delete(scene);
  }
  function configure(scene, settings) {
    if (!scene?.auto) return false;
    let s = sessions.get(scene);
    if (settings.policyMode !== "custom" && !s) return false;
    const nextIdentity = identity(settings, scene, scene.autoHost?.() ?? {});
    if (s && (s.auto !== scene.auto || s.identity !== nextIdentity)) {
      const wasActive = s.settings.policyMode === "custom" && scene.auto.on === true;
      activation.set(scene,false); cleanup(scene); s = null;
      if (wasActive && typeof scene.toggleAutoFarm === "function") scene.toggleAutoFarm();
    }
    if (!s) {
      s = { scene, auto:scene.auto, identity:nextIdentity, settings:{}, removeUpdate:null, state:"OFF", stateAt:performance.now(),
        authorized:activation.get(scene) === true, origin:null, targetId:null, targetSince:0, legGoal:null, path:[], lastPos:null, progressAt:performance.now(), unreachable:new Map(),
        pending:null, attempts:new Map(), lootSkips:new Map(), lootAttempts:new Map(), countedDeaths:new Set(), steer:null, removeInput:null, manualUntil:0, lastDecision:-Infinity,
        lastAction:-Infinity, lastDeath:false, statsEnabled:false, stats:null, message:"Custom Farm đang tắt." };
      if (settings.policyMode === "custom") {
        // These are stale native-selector hints only; custom intent lives in s.targetId/state.
        scene.auto.target=0; scene.auto.think=0; scene.auto.path=[];
        scene.auto.goalX=NaN; scene.auto.goalY=NaN;
      }
      s.cleanup=()=>cleanup(scene);
      s.removeInput=globalThis.GSTFarmInput?.add?.(scene,(accepted)=>{if(accepted)s.manualUntil=performance.now()+700;})??null;
      scene.events?.on?.("shutdown",s.cleanup); scene.events?.on?.("destroy",s.cleanup);
      sessions.set(scene,s); activeScenes.add(scene);
    }
    s.settings = {...settings}; s.statsEnabled = settings.customComparisonEnabled === true;
    if (settings.policyMode === "custom" && !s.removeUpdate && typeof globalThis.GSTFarmUpdate?.add === "function") {
      try { s.removeUpdate = globalThis.GSTFarmUpdate.add(scene, 1000, (host,time,delta) => {
        try { update(scene,host,time,delta); return globalThis.GSTFarmPolicy?.isCustom?.() === true; }
        catch { release(s); transition(s,"WAITING_FOR_DATA","Custom Farm tạm dừng do dữ liệu scene không tương thích."); return true; }
      }); }
      catch { s.message="Custom Farm không khả dụng: không giữ được quyền sở hữu dispatcher."; }
    } else if (settings.policyMode !== "custom" && s.removeUpdate) {
      const wasCustom = s.authorized || s.state !== "OFF";
      release(s); s.removeUpdate(); s.removeUpdate=null; s.authorized=false; activation.set(scene,false);
      if (wasCustom && scene.auto?.on && typeof scene.toggleAutoFarm === "function") scene.toggleAutoFarm();
      transition(s,"OFF","Custom Farm đã dừng khi đổi chế độ.");
    }
    if (s.statsEnabled && !s.stats) {
      s.stats = loadStats(s.identity) ?? {elapsed:0,paused:0,stuck:0,observedDeaths:0,observedKills:0};
    }
    return true;
  }
  function validScene(s) {
    const scene=s?.scene, settings=s?.settings, driver=s?.scene?.driver;
    const gameTime=scene?.now?.();
    return scene && sceneNow()===scene && scene.auto===s.auto && scene.sys?.isActive?.()
      && !scene.leaving && !!scene.self && finite(gameTime) && finite(scene.selfAt)
      && gameTime >= scene.selfAt && gameTime - scene.selfAt <= 3
      && !settings?.identityBlocked && settings?.identityVerified === true
      && !!settings.accountProfileKey && !!settings.accountId && !!settings.characterId
      && !!driver && !driver.closing && !driver.reconnecting && !driver.displaced
      && (driver.online === false || (typeof driver.link?.open === "function" && driver.link.open() === true));
  }
  function visibleCandidates(scene, host, settings, s) {
    let rows=[]; try { rows=host.enemies?.() ?? []; } catch {}
    const out=[], pos={x:scene.px,y:scene.py}, time=scene.now?.();
    for (const e of rows) {
      if (!e || !finite(e.id) || !finite(e.x) || !finite(e.y) || e.dead===true || e.hostile!==true) continue;
      if (e.cls==="pet" || (settings.excludeBoss && (e.cls==="boss"||e.wb))) continue;
      if (globalThis.GSTFarmPriority?.matches?.({cls:e.cls,wb:e.wb,lv:e.lv}) === false) continue;
      const width=scene.map?.w,height=scene.map?.h;
      if (settings.searchScope==="map" && (!finite(width)||!finite(height)||width<=0||height<=0)) continue;
      if (settings.searchScope==="map" && (e.x<0||e.y<0||e.x>width||e.y>height)) continue;
      const d=Math.hypot(e.x-pos.x,e.y-pos.y), from=s.origin?Math.hypot(e.x-s.origin.x,e.y-s.origin.y):0;
      if (settings.searchScope!=="map" && from>settings.radius) continue;
      if (s.unreachable.get(e.id)>time) continue;
      out.push({...e, distance:d, originDistance:from});
    }
    if (settings.allowPlayerTargets === true && typeof scene.views?.values === "function") {
      for (const actor of scene.views.values()) if (actor?.k === "p" && finite(actor.id) && finite(actor.x) && finite(actor.y) && !actor.dead) {
        const row={id:actor.id,x:actor.x,y:actor.y,dead:false,hostile:true,cls:"player",lv:actor.st?.lv,aggro:true,wb:false};
        const d=Math.hypot(row.x-pos.x,row.y-pos.y),from=s.origin?Math.hypot(row.x-s.origin.x,row.y-s.origin.y):0;
        if ((settings.searchScope==="map" || from<=settings.radius) && !(settings.bossFilter==="world") && !(["boss","maxLevel","minLevel","range"].includes(settings.targetMode)) && s.unreachable.get(row.id)<=time) out.push({...row,distance:d,originDistance:from});
      }
    }
    const current=out.find(e=>e.id===s.targetId);
    if (current) return [current, ...out.filter(e=>e.id!==current.id).sort((a,b)=>(b.aggro-a.aggro)||a.distance-b.distance)];
    return out.sort((a,b)=>(globalThis.GSTFarmPriority?.compare?.(a,b)??0)||((b.aggro-a.aggro)||a.distance-b.distance));
  }
  function steerTo(s, host, goal, reach=1.2) {
    const scene=s.scene, settings=s.settings, now=scene.now?.();
    if (!finite(goal?.x)||!finite(goal?.y)||!finite(now)||typeof host.clear!=="function"||typeof host.route!=="function") return false;
    const allowed=(p)=> {
      if (!finite(p?.x)||!finite(p?.y)) return false;
      if (settings.searchScope === "map") {
        const w=scene.map?.w,h=scene.map?.h;
        if (!finite(w)||!finite(h)||p.x<0||p.y<0||p.x>w||p.y>h) return false;
      } else if (s.origin && Math.hypot(p.x-s.origin.x,p.y-s.origin.y)>settings.radius+0.25) return false;
      return globalThis.GSTFarmBossSafety?.allowsTarget?.(scene,p) !== false;
    };
    if (!allowed(goal)) return false;
    const point=globalThis.GSTNavigation?.leg?.(scene,s,host,goal.x,goal.y,allowed);
    if (!point || !finite(point.x)||!finite(point.y)) { release(s); return false; }
    if (globalThis.GSTFarmBossSafety?.allowsSegment?.(scene,{x:scene.px,y:scene.py},point) === false) {
      globalThis.GSTNavigation?.resetLeg?.(s,true); return false;
    }
    const dx=point.x-scene.px,dy=point.y-scene.py,d=Math.hypot(dx,dy);
    if (!finite(d)||d<0.15) { release(s); return Math.hypot(goal.x-scene.px,goal.y-scene.py)<=reach; }
    const x=dx/d,y=dy/d;
    scene.autoX=x; scene.autoY=y; s.steer=[x,y]; s.legGoal={...goal}; s.path=[[point.x,point.y]]; globalThis.GSTNavigation?.schedule?.(scene,s,goal.x,goal.y,reach);
    if (!s.lastPos || Math.hypot(scene.px-s.lastPos.x,scene.py-s.lastPos.y)>=0.5) {
      s.lastPos={x:scene.px,y:scene.py}; s.progressAt=performance.now();
    }
    return Math.hypot(goal.x-scene.px,goal.y-scene.py)<=reach;
  }
  function actionReady(s, now) { return !s.pending || now>=s.pending.until; }
  function act(s, host, target, time) {
    const scene=s.scene, now=performance.now();
    if (now-s.lastAction<700 || !actionReady(s,now)) return;
    const distance=Math.hypot(target.x-scene.px,target.y-scene.py), keys=host.skills?.() ?? [];
    let choices=[];
    for (const key of keys) {
      const kit=host.kit?.(key);
      if (!kit || !finite(kit.range)) continue;
      const wait=scene.skillWait?.(key);
      if (!finite(wait)||wait>0 || distance>kit.range+0.25) continue;
      choices.push({key,kit});
    }
    choices.sort((a,b)=>(b.kit.dmg-a.kit.dmg)||(b.kit.range-a.kit.range));
    let accepted=false, kind="basic", skill="";
    try {
      if (choices.length) { skill=choices[0].key; accepted=host.cast(skill,target.x,target.y)===true; kind="skill"; }
      else if (distance<=2.2) accepted=host.basic()!==false;
    } catch {}
    if (!accepted) return;
    s.lastAction=now; s.pending={kind,skill,targetId:target.id,beforeHp:target.hpPct,snapshotAt:scene.selfAt??time,until:now+1200};
    s.attempts.set(target.id,(s.attempts.get(target.id)||0)+1); if(s.attempts.size>128)s.attempts.delete(s.attempts.keys().next().value);
    if (s.attempts.get(target.id)>2) s.unreachable.set(target.id,time+8); if(s.unreachable.size>128)s.unreachable.delete(s.unreachable.keys().next().value);
  }
  function update(scene, host, time, delta) {
    let s=sessions.get(scene);
    if (!s) return false;
    const settings=s.settings, now=performance.now(), dt=clamp(finite(delta)?delta:0,0,1000);
    if (settings.policyMode!=="custom" || !scene.auto?.on) { release(s); transition(s,"OFF","Custom Farm đang tắt."); saveStats(s); return false; }
    if (s.authorized !== true) { release(s); transition(s,"PAUSED","Custom Farm chưa được bật trực tiếp trong tab này."); stat(s,"paused",dt); return true; }
    if (!s.removeUpdate || !globalThis.GSTFarmUpdate.attached(scene)) { release(s); transition(s,"WAITING_FOR_DATA","Custom Farm đã tạm dừng: dispatcher không khả dụng."); stat(s,"paused",dt); return true; }
    if (!validScene(s)) { release(s); transition(s,"WAITING_FOR_DATA","Đang chờ xác nhận lại tài khoản, nhân vật và scene."); stat(s,"paused",dt); return true; }
    if (!finite(time)||!finite(delta)||!finite(scene.px)||!finite(scene.py)||!host
        || !["enemies","route","clear","skills","kit","cast","basic","loot","pickup","hp","dead"].every(k=>typeof host[k]==="function")
        || typeof scene.skillWait!=="function") {
      release(s); transition(s,"WAITING_FOR_DATA","Thiếu dữ liệu native hợp lệ; Custom Farm đã tạm dừng."); stat(s,"paused",dt); return true;
    }
    const currentIdentity=identity(settings,scene,host);
    if (currentIdentity!==s.identity) { release(s); transition(s,"OFF","Danh tính hoặc khu vực đã đổi; hãy bật Farm lại."); if(scene.auto.on&&typeof scene.toggleAutoFarm==="function")scene.toggleAutoFarm(); saveStats(s); return true; }
    if (!s.origin) s.origin={x:scene.px,y:scene.py};
    if (globalThis.GSTFarmInput?.movement?.(scene) || now < s.manualUntil || scene.pendingSkill || scene.aiming || scene.harvesting || scene.self?.fish) { release(s); transition(s,"PAUSED","Đang nhường thao tác di chuyển bằng tay."); stat(s,"paused",dt); return true; }
    if (host.meditating?.() === true) { release(s); transition(s,"PAUSED","Đang thiền thủ công; Custom Farm tạm nhường."); stat(s,"paused",dt); return true; }
    if ([globalThis.GSTMapTravel,globalThis.GSTQuest,globalThis.GSTFarmSeals,globalThis.GSTRealm,globalThis.GSTChest,globalThis.GSTHarvest,globalThis.GSTFarmBossSafety,globalThis.GSTFarmDefense]
        .some((owner)=>{try{return owner?.controls?.(scene)===true;}catch{return false;}})) {
      release(s); transition(s,"PAUSED","Đang nhường thao tác cho một tính năng khác."); stat(s,"paused",dt); return true;
    }
    if (globalThis.GSTAutoPotion?.busy?.(scene) === true) { release(s); transition(s,"RECOVERY","Auto Potion đang sử dụng thao tác hồi phục."); stat(s,"paused",dt); return true; }
    if (s.targetId !== null) {
      const prior=scene.views?.get?.(s.targetId);
      if (prior?.dead === true && !s.countedDeaths.has(s.targetId)) {
        if (s.stats) s.stats.observedKills=clamp(s.stats.observedKills+1,0,100000);
        s.countedDeaths.add(s.targetId);
        if (s.countedDeaths.size>256) s.countedDeaths.delete(s.countedDeaths.values().next().value);
      }
    }
    const dead=host.dead();
    if (dead===true) {
      release(s);
      if (globalThis.GSTFarmSession?.keepEnabled?.() === false && scene.auto.on && typeof scene.toggleAutoFarm === "function") scene.toggleAutoFarm();
      transition(s,"DEAD","Nhân vật đã chết; chờ luồng hồi sinh đã cấu hình.");
      if (!s.lastDeath) s.stats && (s.stats.observedDeaths=clamp(s.stats.observedDeaths+1,0,100000));
      s.lastDeath=true; stat(s,"paused",dt); saveStats(s); return true;
    }
    if (dead!==false || !finite(host.hp())) { release(s); transition(s,"WAITING_FOR_DATA","Đang chờ HP và trạng thái nhân vật."); stat(s,"paused",dt); return true; }
    if (s.lastDeath) { s.lastDeath=false; s.origin={x:scene.px,y:scene.py}; s.targetId=null; }
    if (!finite(s.lastDecision)||now-s.lastDecision>=180) {
      s.lastDecision=now;
      const flight=globalThis.GSTFlight?.snapshot?.();
      if (flight?.wanted && !flight.flying) { release(s); transition(s,"PAUSED","Đang chờ chủ sở hữu Auto Flight đã cấu hình."); stat(s,"paused",dt); return true; }
      if (settings.searchScope==="map" && (!finite(scene.map?.w)||!finite(scene.map?.h)||scene.map.w<=0||scene.map.h<=0)) {
        release(s); transition(s,"WAITING_FOR_DATA","Đang chờ ranh giới map hợp lệ."); stat(s,"paused",dt); return true;
      }
      const hp=host.hp();
      const recoveryActive=s.state==="RECOVERY";
      if (hp < (recoveryActive ? settings.recoveryHpPercent : settings.retreatHpPercent)/100) {
        if (now-s.stateAt>10000) {
          release(s); transition(s,"RECOVERY","Đã hết thời gian lùi có giới hạn; đang chờ HP hoặc Auto Potion đã cấu hình.");
        } else if (settings.bossRetreat === true && hp < settings.retreatHpPercent/100
            && s.origin && Math.hypot(scene.px-s.origin.x,scene.py-s.origin.y)>2) {
          transition(s,"RECOVERY","HP thấp; đang lùi về điểm bắt đầu. Auto Potion vẫn do cài đặt riêng xử lý.");
          if (!steerTo(s,host,s.origin,1.5)) { release(s); note(s,"HP thấp; đang chờ hồi phục hoặc potion đã cấu hình."); }
        } else { release(s); transition(s,"RECOVERY","Đang chờ HP đạt ngưỡng hồi phục hoặc Auto Potion đã cấu hình. Thiền tự động tắt."); }
        stat(s,"paused",dt); return true;
      }
      if (s.pending && ["skill","basic"].includes(s.pending.kind)) {
        const observed=scene.views?.get?.(s.pending.targetId), currentHp=observed?.st?.mh>0?observed.st.hp/observed.st.mh:null;
        if (finite(scene.selfAt) && scene.selfAt > s.pending.snapshotAt
            && (observed?.dead===true || finite(currentHp) && finite(s.pending.beforeHp)
              && currentHp < s.pending.beforeHp - 0.001)) s.pending=null;
      }
      if (s.pending && now < s.pending.until) {
        release(s); transition(s,"WAITING_FOR_DATA","Đang chờ snapshot mới hoặc timeout của thao tác trước."); stat(s,"paused",dt); return true;
      }
      if (s.pending && now >= s.pending.until) s.pending=null;
      const candidates=visibleCandidates(scene,host,settings,s);
      if (!candidates.length) {
        s.targetId=null;
        const drops=settings.preferLoot === false ? [] : (host.loot?.()??[]);
        const drop=drops.filter(p=>finite(p.x)&&finite(p.y)&&(s.lootAttempts.get(p.x+","+p.y)||0)<2&&!(s.lootSkips.get(p.x+","+p.y)>now))
          .sort((a,b)=>Math.hypot(a.x-scene.px,a.y-scene.py)-Math.hypot(b.x-scene.px,b.y-scene.py))[0];
        if (drop) {
          transition(s,"LOOT","Đang tiếp cận vật phẩm nhìn thấy.");
          const reached=steerTo(s,host,drop,1.4);
          if (reached && now-s.lastAction>900) {
            const key=drop.x+","+drop.y, tries=s.lootAttempts.get(key)||0;
            if (tries < 2) try {
              host.pickup(); s.lastAction=now; s.lootAttempts.set(key,tries+1); if(s.lootAttempts.size>128)s.lootAttempts.delete(s.lootAttempts.keys().next().value);
              s.lootSkips.set(key,now+2500); if(s.lootSkips.size>128)s.lootSkips.delete(s.lootSkips.keys().next().value); s.pending={kind:"pickup",targetId:key,snapshotAt:scene.selfAt??time,until:now+1800};
            } catch {}
          }
        } else { release(s); transition(s,"SEARCH","Đang tìm mục tiêu hiển thị trong vùng đã cấu hình."); }
        stat(s,"elapsed",dt); return true;
      }
      const defensiveId=globalThis.GSTFarmDefense?.preferredTarget?.(scene);
      const target=candidates.find((item)=>item.id===defensiveId) ?? candidates[0];
      if (s.targetId!==target.id) { s.targetId=target.id; s.targetSince=time; s.progressAt=now; s.lastPos={x:scene.px,y:scene.py}; s.attempts.set(target.id,0); }
      const viewed=scene.views?.get?.(target.id);
      if (viewed?.dead===true && !s.countedDeaths.has(target.id)) { s.countedDeaths.add(target.id); if(s.stats) s.stats.observedKills=clamp(s.stats.observedKills+1,0,100000); }

      if (s.pending && now < s.pending.until) { release(s); transition(s,"WAITING_FOR_DATA","Đang chờ snapshot mới hoặc timeout của thao tác trước."); stat(s,"paused",dt); return true; }
      if (s.pending && now >= s.pending.until) s.pending=null;
      const skills=(host.skills?.()??[]).map(key=>host.kit?.(key)).filter(k=>k&&finite(k.range));
      const maxRange=skills.reduce((m,k)=>Math.max(m,k.castRange??k.range),1.3)+(target.radius||0.8);
      if (target.distance>Math.min(maxRange,30)) {
        transition(s,"APPROACH","Đang tiếp cận mục tiêu hiển thị.");
        const reached=steerTo(s,host,target,Math.max(1.5,Math.min(2.2,maxRange*0.65)));
        if (now-s.progressAt>6000) { s.unreachable.set(target.id,time+12); s.targetId=null; release(s); stat(s,"stuck",Math.max(dt,Math.min(now-s.progressAt,6000))); transition(s,"SEARCH","Mục tiêu tạm bị bỏ qua sau khi không có tiến triển."); }
      } else {
        release(s); host.face?.(target.x,target.y,target.id); transition(s,"COMBAT","Đang đánh mục tiêu hiển thị.");
        act(s,host,target,time);
      }
      stat(s,"elapsed",dt);
    } else stat(s,"elapsed",dt);
    saveStats(s);
    return true;
  }
  const manualKey = (event) => {
    if (!event.isTrusted || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target?.closest?.("input,textarea,select,[contenteditable=true],#gst-game-menu")) return;
    const s=sessions.get(sceneNow()); if (s) s.manualUntil=performance.now()+700;
  };
  const manualPointer = (event) => {
    if (!event.isTrusted || !event.target?.closest?.("canvas")) return;
    const s=sessions.get(sceneNow()); if (s) s.manualUntil=performance.now()+700;
  };
  document.addEventListener("keydown",manualKey,true);
  document.addEventListener("pointerdown",manualPointer,true);
  window.addEventListener("pagehide",()=>{ for (const scene of [...activeScenes]) cleanup(scene); });
  globalThis.GSTCustomFarm=Object.freeze({configure,update,states,state(scene){return sessions.get(scene)?.state??"OFF";},
    status(scene){return sessions.get(scene)?.message??"Custom Farm chưa được cấu hình.";},
    stats(scene){const s=sessions.get(scene);return s?.statsEnabled&&s.stats?{...s.stats,xpPerMinute:null,potions:null}:null;},
    active(scene){const s=sessions.get(scene);return !!s&&s.settings.policyMode==="custom"&&scene.auto?.on===true&&s.authorized===true;},
    setActivationIntent(scene,enabled){activation.set(scene,enabled===true);const s=sessions.get(scene);if(s)s.authorized=enabled===true;},
    compatible(scene){const s=sessions.get(scene);return !!s&&!!s.removeUpdate&&globalThis.GSTFarmUpdate.attached(scene);},
    authorized(scene){return activation.get(scene)===true&&this.compatible(scene);},
    stop(scene){const s=sessions.get(scene);activation.set(scene,false);if(!s)return;s.authorized=false;release(s);transition(s,"OFF","Custom Farm đang tắt.");saveStats(s);},
    reset(scene){cleanup(scene);},});
})();
