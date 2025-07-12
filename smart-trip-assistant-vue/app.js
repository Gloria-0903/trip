const { createApp, ref, reactive, computed, watch, onMounted, nextTick } = Vue;
createApp({
  template: /*html*/`
    <div>
      <div class="header">
        <h1><i class="fas fa-plane"></i> 智能旅行规划助手</h1>
        <p>分步规划您的旅行，自动获取天气、景点、路线与预算</p>
      </div>
      <div class="step-indicator">
        <div v-for="(step, idx) in steps" :key="idx" class="step" :class="{active: currentStep===idx+1, disabled: !stepStatus[idx]}" @click="goStep(idx+1)">
          {{step}}
        </div>
      </div>
      <div class="progress-bar"><div class="progress" :style="{width: (currentStep/steps.length*100)+'%'}"></div></div>

      <!-- 步骤1：填写信息 -->
      <div v-if="currentStep===1">
        <div class="form-group">
          <label>出发地</label>
          <input type="text" v-model="trip.origin" placeholder="如：北京">
        </div>
        <div class="form-group">
          <label>目的地</label>
          <input type="text" v-model="trip.destination" placeholder="如：上海">
        </div>
        <div class="form-group">
          <label>开始日期</label>
          <input type="date" v-model="trip.startDate" :min="todayStr">
        </div>
        <div class="form-group">
          <label>结束日期</label>
          <input type="date" v-model="trip.endDate" :min="trip.startDate||todayStr">
        </div>
        <div class="form-group">
          <label>旅行人数</label>
          <input type="number" v-model.number="trip.travelers" min="1">
        </div>
        <div class="form-group">
          <label>预算范围</label>
          <select v-model="trip.budget">
            <option value="">请选择预算范围</option>
            <option value="low">经济型 (¥1000-3000)</option>
            <option value="medium">中等 (¥3000-8000)</option>
            <option value="high">高端 (¥8000+)</option>
          </select>
        </div>
        <div class="btn-group">
          <button class="btn" @click="nextStep">下一步 <i class="fas fa-arrow-right"></i></button>
        </div>
      </div>

      <!-- 步骤2：路线交通 -->
      <div v-if="currentStep===2">
        <div class="form-group">
          <label>请选择交通方式</label>
          <div style="display:flex;gap:15px;">
            <button v-for="mode in Object.keys(transportModes)" :key="mode" class="btn" :class="{ 'btn-secondary': trip.transport!==mode }" @click="selectTransport(mode)"><i :class="'fas '+transportModes[mode].icon"></i> {{transportModes[mode].name}}</button>
          </div>
        </div>
        <div class="distance-info">{{distanceInfo}}</div>
        <div class="time-list">
          <div v-for="mode in Object.keys(transportModes)" :key="mode" class="time-item" :class="{active: trip.transport===mode}"><i :class="'fas '+transportModes[mode].icon"></i>{{transportModes[mode].name}}：{{getTimeText(mode)}}</div>
        </div>
        <div id="map" style="width:100%;height:320px;border-radius:12px;margin:20px 0;"></div>
        <div class="btn-group">
          <button class="btn btn-secondary" @click="prevStep"><i class="fas fa-arrow-left"></i> 上一步</button>
          <button class="btn" @click="nextStep">下一步 <i class="fas fa-arrow-right"></i></button>
        </div>
      </div>

      <!-- 步骤3：天气与景点 -->
      <div v-if="currentStep===3">
        <div class="weather-section" style="margin-bottom:30px;">
          <div style='margin-bottom:18px;'>
            <strong style='font-size:1.3rem;'><i class="fas fa-cloud-sun"></i> 天气预报</strong>
            <div style='color:#888;font-size:1rem;margin-top:4px;'>您旅行期间的天气情况</div>
          </div>
          <div style='display:flex;gap:22px;flex-wrap:wrap;'>
            <div v-for="(cast,i) in weatherCasts" :key="i" style='background:#fff;border-radius:18px;box-shadow:0 2px 12px #e3eaf2;padding:28px 32px;min-width:140px;text-align:center;display:flex;flex-direction:column;align-items:center;'>
                             <div style='color:#888;font-weight:600;font-size:1.1rem;margin-bottom:8px;'>周{{weekMap[cast.week]||cast.week}}</div>
               <div style='font-size:2.5rem;color:#ffa500;margin-bottom:8px;'><i :class="'fas '+(weatherIcons[cast.dayweather]||'fa-cloud')"></i></div>
              <div style='font-size:1.5rem;font-weight:700;margin-bottom:4px;'>{{cast.daytemp}}°C</div>
              <div style='color:#888;font-size:1.1rem;'>{{cast.dayweather}}</div>
            </div>
          </div>
        </div>
        <div class="poi-section">
          <div>推荐景点：</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:10px;">
            <div v-for="(poi,idx) in pois" :key="poi.id||idx" style='background:#f8fafd;border-radius:10px;box-shadow:0 2px 8px #e3eaf2;padding:10px 10px 15px 10px;cursor:pointer;' @click="togglePOI(idx)">
              <div style='height:120px;' :style="poi.photos&&poi.photos[0]?'background:url('+poi.photos[0].url+') center/cover':'background:#e3eaf2'"></div>
              <div style='font-weight:600;margin:8px 0 4px 0;'>{{poi.name}}</div>
              <div style='font-size:0.95rem;color:#888;'>{{poi.address||'地址未提供'}}</div>
              <div style='font-size:0.9rem;color:#1976d2;margin-top:4px;'>{{poi.type.split(';')[0]||'风景名胜'}}</div>
              <div style='margin-top:6px;font-size:0.9rem;'><i class="fas fa-star" style="color:#f7b731;"></i> 评分: {{poi.importance||'4.0'}}</div>
              <div style='margin-top:4px;font-size:0.9rem;'><i class="fas fa-ticket-alt"></i> 门票: 免费</div>
              <div style='margin-top:6px;font-size:0.9rem;color:#26d0ce;'>点击{{selectedPOIs.includes(idx)?'移除':'添加'}}</div>
            </div>
          </div>
        </div>
        <div class="btn-group">
          <button class="btn btn-secondary" @click="prevStep"><i class="fas fa-arrow-left"></i> 上一步</button>
          <button class="btn" @click="nextStep">下一步 <i class="fas fa-arrow-right"></i></button>
        </div>
      </div>

      <!-- 步骤4：行程总结 -->
      <div v-if="currentStep===4" class="summary-section">
        <div class='summary-success'>
          <div class='success-icon'><i class="fas fa-check-circle"></i></div>
          <div style='font-size:1.5rem;font-weight:700;margin-bottom:6px;'>行程规划完成！</div>
          <div style='color:#666;font-size:1.08rem;'>您已成功规划本次旅行。可以下载行程单或返回修改。</div>
        </div>
        <div class='summary-card'>
          <div class='summary-title'><i class="fas fa-file-alt"></i> 行程概览</div>
          <div class='summary-grid'>
            <div class='summary-item'><div class='item-label'><i class="fas fa-map-marker-alt"></i> 目的地</div>{{trip.destination}}</div>
            <div class='summary-item'><div class='item-label'><i class="fas fa-calendar-alt"></i> 旅行日期</div>{{trip.startDate}} 至 {{trip.endDate}}</div>
            <div class='summary-item'><div class='item-label'><i class="fas fa-user-friends"></i> 旅行人数</div>{{trip.travelers}} 人</div>
            <div class='summary-item'><div class='item-label'><i class="fas fa-route"></i> 交通方式</div>{{transportModes[trip.transport].name}}</div>
          </div>
          <div class='summary-item' style='margin-bottom:0;'>
            <div class='item-label'><i class="fas fa-cloud-sun"></i> 天气预报</div>
            旅行期间平均温度: {{avgTemp}}°C
          </div>
          <div class='summary-item' style='margin-bottom:0;'>
            <div class='item-label'><i class="fas fa-map-marked-alt"></i> 推荐景点</div>
            <ul v-if="selectedPOIs.length>0" style='margin:0 0 0 18px;padding:0;'><li v-for="idx in selectedPOIs" :key="idx">{{pois[idx].name}}</li></ul>
            <span v-else>未选择景点</span>
          </div>
        </div>
        <div class='summary-card'>
          <div class='summary-title'><i class="fas fa-calculator"></i> 预算估算</div>
          <div style='display:flex;flex-wrap:wrap;gap:30px;font-size:1.1rem;margin-bottom:10px;'>
            <div>交通费用: <b>¥{{budget.transportCost}}</b></div>
            <div>住宿费用 ({{budget.days}}晚): <b>¥{{budget.accommodationCost}}</b></div>
            <div>景点门票: <b>¥{{budget.ticketCost}}</b></div>
            <div style='font-weight:700;'>总预算: <b>¥{{budget.total}}</b></div>
          </div>
        </div>
        <div class='btn-group'>
          <button class="btn btn-secondary" @click="goStep(1)"><i class="fas fa-edit"></i> 修改</button>
          <button class="btn" @click="restart" style="background:linear-gradient(90deg,#1a2980,#26d0ce);color:#fff;"><i class="fas fa-redo"></i> 重新规划</button>
          <button class="btn" @click="downloadPDF" style="background:#4361ee;color:#fff;"><i class="fas fa-file-download"></i> 下载行程单 (PDF)</button>
        </div>
      </div>
    </div>
  `,
  setup() {
     // 步骤与状态
     const steps = ['1. 目的地', '2. 路线交通', '3. 天气景点', '4. 行程总结'];
     const currentStep = ref(1);
     const stepStatus = reactive([true, false, false, false]);
     // 表单数据
     const trip = reactive({
       origin: '',
       destination: '',
       startDate: '',
       endDate: '',
       travelers: 1,
       transport: 'driving',
       budget: ''
     });
     // 交通方式
     const transportModes = {
       driving: { name: '驾车', speed: 60, icon: 'fa-car' },
       walking: { name: '步行', speed: 5, icon: 'fa-walking' },
       bicycling: { name: '骑行', speed: 15, icon: 'fa-bicycle' },
       airplane: { name: '飞行', speed: 800, icon: 'fa-plane' }
     };
     // 天气图标
     const weatherIcons = {
       "晴": "fa-sun",
       "多云": "fa-cloud",
       "阴": "fa-cloud",
       "小雨": "fa-cloud-rain",
       "中雨": "fa-cloud-showers-heavy",
       "大雨": "fa-cloud-showers-heavy",
       "暴雨": "fa-poo-storm",
       "雷阵雨": "fa-bolt",
       "阵雨": "fa-cloud-sun-rain",
       "小雪": "fa-snowflake",
       "中雪": "fa-snowflake",
       "大雪": "fa-snowman",
       "雾": "fa-smog",
       "霾": "fa-smog"
     };
     const weekMap = {1:'一',2:'二',3:'三',4:'四',5:'五',6:'六',7:'日'};
     // 其他状态
     const pois = ref([]);
     const selectedPOIs = ref([]);
     const weatherCasts = ref([]);
     const distance = ref(null);
     const todayStr = new Date().toISOString().split('T')[0];
     // 预算
     const budget = computed(()=>{
       const transportCostMap = {driving: 300, walking: 0, bicycling: 50, airplane: 1200};
       const transportCost = (transportCostMap[trip.transport] || 0) * trip.travelers;
       const dailyCost = trip.budget === 'low' ? 200 : trip.budget === 'high' ? 800 : 400;
       const days = getTripDays();
       const accommodationCost = dailyCost * days * trip.travelers;
       const ticketCost = (selectedPOIs.value.length || 0) * 50 * trip.travelers;
       const total = transportCost + accommodationCost + ticketCost;
       return {transportCost, accommodationCost, ticketCost, total, days};
     });
     function getTripDays() {
       if(!trip.startDate || !trip.endDate) return 1;
       const start = new Date(trip.startDate);
       const end = new Date(trip.endDate);
       return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
     }
     // 平均温度
     const avgTemp = computed(()=>{
       if(weatherCasts.value.length===0) return '--';
       let sum = 0;
       weatherCasts.value.slice(0,5).forEach(c=>{sum += Number(c.daytemp)||0;});
       return (sum/Math.min(5,weatherCasts.value.length)).toFixed(1);
     });
     // 距离与时间
     const distanceInfo = computed(()=>{
       if(distance.value==null) return '距离计算中...';
       return `两地直线距离约 ${distance.value.toFixed(1)} 公里`;
     });
     function getTimeText(mode) {
       if(distance.value==null) return '--';
       const speed = transportModes[mode].speed;
       const hours = distance.value / speed;
       if (speed >= 100) {
         return `${hours.toFixed(2)} 小时`;
       } else {
         const h = Math.floor(hours);
         const m = Math.round((hours - h) * 60);
         return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
       }
     }
     // 步骤切换
     function goStep(step) {
       if(stepStatus[step-1] || step===currentStep.value) currentStep.value = step;
     }
     function nextStep() {
       if(currentStep.value===1) {
         if(!trip.destination || !trip.startDate || !trip.endDate || trip.travelers<1) {
           alert('请填写完整信息'); return;
         }
         stepStatus[1]=true;
         currentStep.value=2;
         nextTick(()=>initMap());
       } else if(currentStep.value===2) {
         stepStatus[2]=true;
         currentStep.value=3;
         fetchWeatherAndPOI();
       } else if(currentStep.value===3) {
         stepStatus[3]=true;
         currentStep.value=4;
       }
     }
     function prevStep() {
       if(currentStep.value>1) currentStep.value--;
     }
     function restart() {
       window.location.reload();
     }
     function selectTransport(mode) {
       trip.transport = mode;
     }
     function togglePOI(idx) {
       const i = selectedPOIs.value.indexOf(idx);
       if(i>-1) selectedPOIs.value.splice(i,1);
       else selectedPOIs.value.push(idx);
     }
     // 地图与距离
     function getLocation(address) {
       const apiKey = "d6252339014b34205c7ab52961b96dd1";
       return fetch(`https://restapi.amap.com/v3/geocode/geo?key=${apiKey}&address=${encodeURIComponent(address)}`)
         .then(res=>res.json())
         .then(data=>{
           if(data.status==='1' && data.geocodes.length>0 && data.geocodes[0].location) {
             const [lng, lat] = data.geocodes[0].location.split(',').map(Number);
             if(!isNaN(lng)&&!isNaN(lat)) return {lng,lat};
           }
           throw new Error('地理编码失败');
         });
     }
     function getDistance(lat1, lng1, lat2, lng2) {
       const toRad = d => d * Math.PI / 180;
       const R = 6371;
       const dLat = toRad(lat2 - lat1);
       const dLng = toRad(lng2 - lng1);
       const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
       return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
     }
     function initMap() {
       const start = trip.origin||'北京';
       const end = trip.destination||'上海';
       Promise.all([
         getLocation(start),
         getLocation(end)
       ]).then(([startLoc,endLoc])=>{
         // 地图
         if(!window._amap2) {
           window._amap2 = new AMap.Map('map', {
             zoom: 10,
             center: [startLoc.lng, startLoc.lat],
             viewMode: '3D',
           });
           window._amap2.addControl(new AMap.ToolBar());
           window._amap2.addControl(new AMap.Scale());
           window._amap2.addControl(new AMap.HawkEye());
         } else {
           window._amap2.clearMap();
           window._amap2.setCenter([startLoc.lng, startLoc.lat]);
         }
         new AMap.Marker({ position: [startLoc.lng, startLoc.lat], map: window._amap2, title: start });
         new AMap.Marker({ position: [endLoc.lng, endLoc.lat], map: window._amap2, title: end });
         // 路线
         const p1 = [startLoc.lng, startLoc.lat];
         const p2 = [endLoc.lng, endLoc.lat];
         const mx = (p1[0] + p2[0]) / 2;
         const my = (p1[1] + p2[1]) / 2;
         let dx = p2[0] - p1[0];
         let dy = p2[1] - p1[1];
         let nx = -dy, ny = dx;
         let curveFactor = 0.15;
         let len = Math.sqrt(nx*nx + ny*ny);
         if (len === 0) len = 1;
         nx = nx / len;
         ny = ny / len;
         const ctrl = [mx + nx * curveFactor * Math.sqrt(dx*dx + dy*dy), my + ny * curveFactor * Math.sqrt(dx*dx + dy*dy)];
         function getBezierPoints(p1, ctrl, p2, num) {
           const pts = [];
           for (let t = 0; t <= 1; t += 1/num) {
             const x = (1-t)*(1-t)*p1[0] + 2*(1-t)*t*ctrl[0] + t*t*p2[0];
             const y = (1-t)*(1-t)*p1[1] + 2*(1-t)*t*ctrl[1] + t*t*p2[1];
             pts.push([x, y]);
           }
           return pts;
         }
         const bezierPath = getBezierPoints(p1, ctrl, p2, 50);
         new AMap.Polyline({
           path: bezierPath,
           strokeColor: '#0091ff',
           strokeWeight: 4,
           isOutline: true,
           outlineColor: '#fff',
           lineJoin: 'round',
           map: window._amap2
         });
         window._amap2.setFitView();
         // 距离
         distance.value = getDistance(startLoc.lat, startLoc.lng, endLoc.lat, endLoc.lng);
       });
     }
     // 天气和景点
     function fetchWeatherAndPOI() {
       const apiKey = "d6252339014b34205c7ab52961b96dd1";
       const weatherBaseUrl = "https://restapi.amap.com/v3/weather/weatherInfo";
       const poiBaseUrl = "https://restapi.amap.com/v3/place/text";
       const endCity = trip.destination;
       // 天气
       const weatherForecastUrl = `${weatherBaseUrl}?key=${apiKey}&city=${encodeURIComponent(endCity)}&extensions=all`;
       // 景点
       const poiParams = new URLSearchParams({
         key: apiKey,
         keywords: "景点",
         city: endCity,
         types: "风景名胜",
         offset: 10,
         page: 1,
         extensions: "all",
         output: "JSON"
       });
       const poiUrl = `${poiBaseUrl}?${poiParams.toString()}`;
       Promise.all([
         fetch(weatherForecastUrl).then(res => res.json()),
         fetch(poiUrl).then(res => res.json())
       ]).then(([forecastData, poiData]) => {
         // 天气
         if (forecastData.status === "1" && forecastData.forecasts && forecastData.forecasts[0] && forecastData.forecasts[0].casts) {
           weatherCasts.value = forecastData.forecasts[0].casts;
         } else {
           weatherCasts.value = [];
         }
         // 景点
         if (poiData.status === "1" && poiData.pois && poiData.pois.length > 0) {
           pois.value = poiData.pois;
         } else {
           pois.value = [];
         }
       });
     }
     // PDF导出
     function downloadPDF() {
       const { jsPDF } = window.jspdf;
       const doc = new jsPDF();
       let y = 20;
       doc.setFont('helvetica');
       doc.setFontSize(20);
       doc.text('智能旅行规划助手 - 行程单', 20, y);
       y += 15;
       doc.setFontSize(13);
       doc.text('出发地: ' + (trip.origin||'--'), 20, y);
       y += 8;
       doc.text('目的地: ' + trip.destination, 20, y);
       y += 8;
       doc.text('日期: ' + trip.startDate + ' 至 ' + trip.endDate, 20, y);
       y += 8;
       doc.text('人数: ' + trip.travelers + ' 人', 20, y);
       y += 8;
       doc.text('交通方式: ' + transportModes[trip.transport].name, 20, y);
       y += 8;
       doc.text('预算: ' + (trip.budget==='low'?'经济型':trip.budget==='medium'?'中等':trip.budget==='high'?'高端':'--'), 20, y);
       y += 12;
       doc.setFontSize(15);
       doc.text('预算估算', 20, y);
       y += 8;
       doc.setFontSize(12);
       doc.text('交通费用: ¥' + budget.value.transportCost, 20, y);
       y += 7;
       doc.text('住宿费用: ¥' + budget.value.accommodationCost, 20, y);
       y += 7;
       doc.text('景点门票: ¥' + budget.value.ticketCost, 20, y);
       y += 7;
       doc.text('总预算: ¥' + budget.value.total, 20, y);
       y += 12;
       doc.setFontSize(15);
       doc.text('推荐景点', 20, y);
       y += 8;
       doc.setFontSize(12);
       if(pois.value && selectedPOIs.value.length>0) {
         selectedPOIs.value.forEach((idx,i)=>{
           const poi = pois.value[idx];
           doc.text((i+1)+'. '+poi.name+' - '+(poi.address||''), 22, y);
           y += 7;
         });
       } else {
         doc.text('无', 22, y);
         y += 7;
       }
       y += 8;
       doc.setFontSize(13);
       doc.text('感谢使用智能旅行规划助手！', 20, y);
       doc.save('旅行行程单.pdf');
     }
     // 地图初始化
     watch(()=>currentStep.value, (val)=>{
       if(val===2) nextTick(()=>initMap());
       if(val===3) fetchWeatherAndPOI();
     });
     return {
       steps, currentStep, stepStatus, trip, transportModes, weatherIcons, weekMap, pois, selectedPOIs, weatherCasts, todayStr,
       distance, distanceInfo, getTimeText, goStep, nextStep, prevStep, restart, selectTransport, togglePOI, avgTemp, budget, downloadPDF
     };
   }
 }).mount('#app');