let gameState = {
            wallet: null,
            usdc: 124.50,
            water: 48,
            seeds: { strawberry: 6, blueberry: 4, golden: 1 },
            insumos: 3,
            plots: [],
            unlockedPlots: 2,
            stats: { videosWatchedToday: 2, freshBerries: 124 },
            lastVideoReset: Date.now(),
            lastWithdrawal: null,
            withdrawalHistory: [],
            referralCode: null,
            referredBy: null,
            referralEarnings: 0,
            referredUsers: 0,
            
            // New systems
            loginStreak: 1,
            lastLoginDate: null,
            lastStreakClaim: null,
            dailyMissions: {},
            lastMissionsReset: null,
            
            // Abandoned Farms / Raiding
            abandonedFarms: [],
            lastFarmsRefresh: null,
            raidCooldownUntil: null,
            raidTools: {
                dogBone: 0,
                stealthKit: 0
            },
            
            // ADN Collection & Laboratory System
            adn: {
                baby: 0,
                basic: 0,
                rapid: 0,
                premium: 0,
                elite: 0
            },
            activeFusions: [], // Plants being created in lab (24h timer)
            
            lastSave: Date.now()
        };

        const MAX_PLOTS = 8;
        const PLOT_COSTS_USDC = [0, 0, 45, 75, 145, 270, 490, 870];
        const MAX_VIDEOS_PER_DAY = 8;
        const WITHDRAWAL_COOLDOWN_DAYS = 15;
        const REFERRAL_COMMISSION = 0.05;

        const berryTypes = {
            baby:    { name: "Frutilla Bebé",     emoji: "🍓", harvestCooldown: 6 * 60 * 60 * 1000, harvestReward: 0.07, price: 5 },
            basic:   { name: "Frutilla Básica",   emoji: "🍓", harvestCooldown: 8 * 60 * 60 * 1000, harvestReward: 0.28, price: 18 },
            rapid:   { name: "Frutilla Rápida",   emoji: "🍓", harvestCooldown: 5 * 60 * 60 * 1000, harvestReward: 0.22, price: 15 },
            premium: { name: "Frutilla Premium",  emoji: "🍒", harvestCooldown: 12 * 60 * 60 * 1000, harvestReward: 0.82, price: 68 },
            elite:   { name: "Frutilla Élite",    emoji: "🍇", harvestCooldown: 24 * 60 * 60 * 1000, harvestReward: 1.55, price: 125 },

            // Premium Plant
            legendary: { 
                name: "Frutilla Legendaria", 
                emoji: "🌟", 
                harvestCooldown: 6 * 60 * 60 * 1000, 
                harvestReward: 2.35, 
                price: 500,
                noWater: true,
                immuneToPests: true
            }
        };

// TESTING MODE - Set to true to bypass wallet requirement for testing
const TESTING_MODE = true;

        // ==================== DAILY MISSIONS CONFIG ====================
        function getDailyMissionsConfig() {
            return [
                {
                    id: 'water_plants',
                    title: 'Regar 5 plantas',
                    target: 5,
                    reward: { usdc: 0.8, water: 15 },
                    icon: 'fa-tint'
                },
                {
                    id: 'watch_videos',
                    title: 'Ver 5 videos',
                    target: 5,
                    reward: { usdc: 0.7, water: 0 },
                    icon: 'fa-play-circle'
                },
                {
                    id: 'harvest_plants',
                    title: 'Cosechar 3 plantas',
                    target: 3,
                    reward: { usdc: 1.0, water: 10 },
                    icon: 'fa-hand-holding-heart'
                }
            ];
        }

        function resetDailyMissionsIfNeeded() {
            const today = new Date().toDateString();
            
            if (!gameState.lastMissionsReset || gameState.lastMissionsReset !== today) {
                const config = getDailyMissionsConfig();
                gameState.dailyMissions = {};
                
                config.forEach(mission => {
                    gameState.dailyMissions[mission.id] = {
                        progress: 0,
                        completed: false,
                        claimed: false
                    };
                });
                
                gameState.lastMissionsReset = today;
                saveGame();
            }
        }

        function updateMissionProgress(missionId, amount = 1) {
            if (!gameState.dailyMissions[missionId]) return;
            
            const mission = gameState.dailyMissions[missionId];
            if (mission.completed || mission.claimed) return;
            
            const config = getDailyMissionsConfig().find(m => m.id === missionId);
            if (!config) return;
            
            mission.progress = Math.min(config.target, mission.progress + amount);
            
            if (mission.progress >= config.target) {
                mission.completed = true;
            }
            
            saveGame();
            
            if (!document.getElementById('content-missions').classList.contains('hidden')) {
                renderMissions();
            }
        }

        function claimMissionReward(missionId) {
            const mission = gameState.dailyMissions[missionId];
            if (!mission || !mission.completed || mission.claimed) return;
            
            const config = getDailyMissionsConfig().find(m => m.id === missionId);
            if (!config) return;
            
            if (config.reward.usdc) gameState.usdc += config.reward.usdc;
            if (config.reward.water) gameState.water += config.reward.water;
            
            mission.claimed = true;
            
            saveGame();
            updateBalances();
            renderMissions();
            
            showToast(`¡Misión completada! +${config.reward.usdc} USDC`, 'success');
        }

        function renderMissions() {
            const container = document.getElementById('missions-list');
            if (!container) return;
            
            resetDailyMissionsIfNeeded();
            
            const config = getDailyMissionsConfig();
            let html = '';
            
            config.forEach(missionConfig => {
                const mission = gameState.dailyMissions[missionConfig.id] || { progress: 0, completed: false, claimed: false };
                const progressPercent = Math.min(100, Math.floor((mission.progress / missionConfig.target) * 100));
                
                let statusHtml = '';
                if (mission.claimed) {
                    statusHtml = `<div class="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-extrabold rounded-3xl">Completada</div>`;
                } else if (mission.completed) {
                    statusHtml = `<button onclick="claimMissionReward('${missionConfig.id}')" class="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-3xl active:scale-[0.985]">Reclamar</button>`;
                } else {
                    statusHtml = `<div class="text-xs text-slate-400 font-medium">${mission.progress}/${missionConfig.target}</div>`;
                }
                
                html += `
                    <div class="mission-card bg-white border border-emerald-100 rounded-3xl p-5">
                        <div class="flex items-center justify-between mb-3">
                            <div class="flex items-center gap-x-3">
                                <i class="fa-solid ${missionConfig.icon} text-emerald-500 text-2xl"></i>
                                <div class="font-extrabold">${missionConfig.title}</div>
                            </div>
                            ${statusHtml}
                        </div>
                        
                        <div class="flex items-center gap-x-3">
                            <div class="flex-1 h-2.5 bg-emerald-100 rounded-full overflow-hidden">
                                <div class="h-2.5 bg-emerald-500 transition-all" style="width: ${progressPercent}%"></div>
                            </div>
                            <div class="text-xs font-mono font-extrabold text-emerald-600 w-10 text-right">${progressPercent}%</div>
                        </div>
                        
                        <div class="mt-3 text-xs text-emerald-600">
                            Recompensa: 
                            ${missionConfig.reward.usdc ? `+${missionConfig.reward.usdc} USDC` : ''}
                            ${missionConfig.reward.water ? ` + ${missionConfig.reward.water} Agua` : ''}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }

        // ==================== LOGIN STREAK ====================
        function checkAndUpdateStreak() {
            const today = new Date().toDateString();
            
            if (!gameState.lastLoginDate) {
                gameState.lastLoginDate = today;
                gameState.loginStreak = 1;
                return;
            }
            
            if (gameState.lastLoginDate === today) {
                return;
            }
            
            const lastDate = new Date(gameState.lastLoginDate);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastDate.toDateString() === yesterday.toDateString()) {
                gameState.loginStreak = (gameState.loginStreak || 1) + 1;
            } else {
                gameState.loginStreak = 1;
            }
            
            gameState.lastLoginDate = today;
            saveGame();
        }

        function getStreakReward(streak) {
            if (streak >= 7) return { usdc: 3.5, water: 25 };
            if (streak >= 5) return { usdc: 2.5, water: 18 };
            if (streak >= 3) return { usdc: 1.8, water: 12 };
            return { usdc: 1.0, water: 8 };
        }

        function claimStreakReward() {
            const today = new Date().toDateString();
            
            if (gameState.lastStreakClaim === today) {
                showToast("Ya reclamaste la recompensa de racha hoy", "error");
                return;
            }
            
            const reward = getStreakReward(gameState.loginStreak || 1);
            
            gameState.usdc += reward.usdc;
            gameState.water += reward.water;
            gameState.lastStreakClaim = today;
            
            saveGame();
            updateBalances();
            
            showToast(`¡Racha de ${gameState.loginStreak} días! +${reward.usdc} USDC + ${reward.water} Agua`, 'success');
            
            if (!document.getElementById('content-missions').classList.contains('hidden')) {
                renderMissions();
            }
        }

        function updateStreakDisplay() {
            const countEl = document.getElementById('streak-count');
            const displayEl = document.getElementById('streak-display');
            const rewardEl = document.getElementById('streak-reward');
            
            const streak = gameState.loginStreak || 1;
            const reward = getStreakReward(streak);
            
            if (countEl) countEl.textContent = streak;
            if (displayEl) displayEl.textContent = streak;
            if (rewardEl) rewardEl.textContent = `+${reward.usdc} USDC`;
        }

        function getSaveKey() { 
            return gameState.wallet ? 'berrychain_' + gameState.wallet : 'berrychain_guest'; 
        }

        function saveGame() {
            gameState.lastSave = Date.now();
            localStorage.setItem(getSaveKey(), JSON.stringify(gameState));
        }

        function loadGame() {
            const key = getSaveKey();
            const saved = localStorage.getItem(key);
            if (saved) gameState = { ...gameState, ...JSON.parse(saved) };
            
            if (!gameState.plots || gameState.plots.length === 0) {
                gameState.plots = [];
                for (let i = 0; i < MAX_PLOTS; i++) {
                    gameState.plots.push({ id: i, type: null, plantedAt: null, lastWatered: null, hasPest: false, growthDuration: 0 });
                }
            }
            if (!gameState.withdrawalHistory) gameState.withdrawalHistory = [];
            if (!gameState.referralEarnings) gameState.referralEarnings = 0;
            if (!gameState.referredUsers) gameState.referredUsers = 0;
            if (!gameState.loginStreak) gameState.loginStreak = 1;
        }

        function updateBalances() {
            const usdcEl = document.getElementById('usdc-balance');
            const waterEl = document.getElementById('water-balance');
            if (usdcEl) usdcEl.textContent = gameState.usdc.toFixed(2);
            if (waterEl) waterEl.textContent = gameState.water;
            
            const wdBalance = document.getElementById('withdrawable-balance');
            if (wdBalance) wdBalance.textContent = gameState.usdc.toFixed(2);
        }

        function showToast(msg, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            const bg = type === 'success' ? 'bg-emerald-600' : type === 'error' ? 'bg-red-600' : 'bg-orange-500';
            toast.className = `${bg} text-white px-5 py-3 rounded-3xl shadow-xl flex items-center gap-x-3 text-sm font-medium max-w-xs`;
            toast.innerHTML = `<div>${msg}</div>`;
            container.appendChild(toast);
            setTimeout(() => { toast.style.transition = 'all .3s ease'; toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 2600);
        }

        function createFloatingReward(text, x, y, color = '#e11d48') {
            const el = document.createElement('div');
            el.className = 'floating-text text-2xl font-black pointer-events-none';
            el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.color = color; el.innerHTML = text;
            document.body.appendChild(el);
            setTimeout(() => { el.style.transition = 'all 1.3s cubic-bezier(0.23,1,0.32,1)'; el.style.transform = `translateY(-90px)`; el.style.opacity = '0'; setTimeout(() => el.remove(), 1300); }, 40);
        }

        // ==================== PLOTS ====================
        function getPlantStage(progress, type) {
            if (progress < 25) return "🌱";
            if (progress < 55) return "🌿";
            if (progress < 100) return berryTypes[type].emoji;
            return berryTypes[type].emoji;
        }

        function renderPlots() {
            const container = document.getElementById('plots-grid');
            container.innerHTML = '';
            
            updateFarmStats(); // Update top stats bar + Espantapájaros status
            
            // === Check for expired welcome Frutilla Bebé (12 days) ===
            const now = Date.now();
            const WELCOME_PLANT_LIFETIME = 12 * 24 * 60 * 60 * 1000; // 12 days
            
            for (let i = 0; i < gameState.plots.length; i++) {
                const plot = gameState.plots[i];
                if (plot.isWelcomePlant && plot.plantedAt && plot.type === 'baby') {
                    if (now - plot.plantedAt > WELCOME_PLANT_LIFETIME) {
                        plot.type = null;
                        plot.plantedAt = null;
                        plot.lastWatered = null;
                        plot.lastHarvest = null;
                        plot.hasPest = false;
                        plot.isWelcomePlant = false;
                        
                        if (!gameState.welcomePlantExpiredNotified) {
                            gameState.welcomePlantExpiredNotified = true;
                            saveGame();
                            setTimeout(() => {
                                showToast("Tu Frutilla Bebé gratis se murió después de 12 días.", 'error');
                            }, 400);
                        }
                    }
                }
            }
            
            const now2 = Date.now();

            for (let i = 0; i < MAX_PLOTS; i++) {
                const plot = gameState.plots[i];
                const isUnlocked = i < gameState.unlockedPlots;
                const card = document.createElement('div');
                let html = '';

                if (!isUnlocked) {
                    card.className = `plot locked berry-card border-2 border-dashed border-emerald-200 rounded-3xl p-5 flex flex-col items-center justify-center min-h-[215px]`;
                    html = `
                        <div class="text-center"><i class="fa-solid fa-lock text-4xl text-emerald-300 mb-3"></i><div class="font-extrabold text-emerald-600">Parcela bloqueada</div></div>
                        <button onclick="buyNewPlotWithUSDC()" class="mt-5 px-8 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold rounded-3xl">Comprar por ${PLOT_COSTS_USDC[i]} USDC</button>
                    `;
                } else if (!plot.type) {
                    card.className = `plot empty berry-card border border-emerald-100 rounded-3xl p-5 flex flex-col min-h-[215px]`;
                    html = `
                        <div class="flex-1 flex flex-col items-center justify-center text-center"><div class="text-7xl mb-1 opacity-30">🪴</div><div class="font-extrabold text-xl text-emerald-300">Parcela lista</div></div>
                        <button onclick="showPlantModal(${i})" class="mt-auto w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-3xl flex items-center justify-center gap-x-2"><i class="fa-solid fa-plus"></i> <span>Plantar</span></button>
                    `;
                } else {
                    const berry = berryTypes[plot.type];
                    const lastHarvest = plot.lastHarvest || plot.plantedAt || now;
                    const timeSinceHarvest = now - lastHarvest;
                    const isReadyToHarvest = timeSinceHarvest >= berry.harvestCooldown;
                    
                    let timeLeftText = '';
                    if (!isReadyToHarvest) {
                        const remaining = berry.harvestCooldown - timeSinceHarvest;
                        const h = Math.floor(remaining / 3600000);
                        const m = Math.floor((remaining % 3600000) / 60000);
                        timeLeftText = h > 0 ? `${h}h ${m}m` : `${m}m`;
                    }
                    
                    const isWilting = !plot.lastWatered || (now - plot.lastWatered) > (berry.harvestCooldown * 1.5);
                    let statusClass = isReadyToHarvest ? 'ready' : isWilting ? 'wilting' : plot.hasPest ? 'pest' : '';

                    card.className = `plot berry-card bg-white border border-emerald-100 rounded-3xl p-4 flex flex-col min-h-[215px] ${isReadyToHarvest ? 'berry-glow' : ''}`;
                    
                    html = `
                        <div class="flex justify-between items-start mb-1">
                            <div class="text-xs px-3 py-0.5 rounded-full font-extrabold bg-emerald-100 text-emerald-700">${berry.name}</div>
                            <span class="font-mono text-xs font-extrabold text-emerald-600">+${berry.harvestReward} USDC</span>
                        </div>
                        
                        <div class="flex-1 flex flex-col items-center justify-center relative py-2">
                            <span class="strawberry ${statusClass}" style="font-size:4.1rem; color:${isWilting ? '#854d0e' : 'inherit'}">
                                ${berry.emoji}
                                <!-- Global scarecrow upgrade applies to all plants -->
                            </span>
                            
                            <div class="mt-2 text-center">
                                ${isReadyToHarvest ? 
                                    `<div class="text-emerald-500 font-extrabold text-sm">¡LISTA PARA COSECHAR!</div>` : 
                                    `<div class="text-xs text-emerald-400">Próxima cosecha en<br><span class="font-mono font-bold">${timeLeftText}</span></div>`
                                }
                            </div>
                            
                            <!-- Water status bar with hours remaining -->
                            ${plot.lastWatered ? (() => {
                                const berry = berryTypes[plot.type];
                                const timeSinceWater = now - plot.lastWatered;
                                const waterThreshold = berry.harvestCooldown * 1.5;
                                const remainingMs = Math.max(0, waterThreshold - timeSinceWater);
                                const remainingHours = (remainingMs / 3600000).toFixed(1);
                                
                                const waterPercent = Math.max(5, Math.min(100, (remainingMs / waterThreshold) * 100));
                                const waterColor = waterPercent > 50 ? 'bg-sky-400' : waterPercent > 20 ? 'bg-yellow-400' : 'bg-red-400';
                                
                                return `
                                    <div class="mt-2 px-1">
                                        <div class="flex justify-between text-[10px] text-sky-600 mb-0.5 font-medium">
                                            <span>💧 Agua</span>
                                            <span class="font-mono font-extrabold text-sky-700">${remainingHours}h</span>
                                        </div>
                                        <div class="h-2.5 bg-sky-100 rounded-full overflow-hidden border border-sky-200">
                                            <div class="h-2.5 transition-all duration-300 ${waterColor}" style="width: ${waterPercent}%"></div>
                                        </div>
                                    </div>
                                `;
                            })() : 
                            `<div class="text-[10px] text-orange-500 font-bold mt-1">💧 Nunca regada</div>`
                            }
                        </div>
                        
                        <div class="mt-auto">
                            ${isReadyToHarvest ? 
                              <button onclick="sellPlant(${i})" class="px-3 py-2 text-xs font-extrabold bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-3xl flex items-center justify-center active:scale-90 transition-transform" title="Vender planta">
                             <i class="fa-solid fa-dollar-sign"></i>
                             </button>
                                `<button onclick="harvestPlot(${i}, event)" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-3xl flex items-center justify-center gap-x-2"><i class="fa-solid fa-hand-holding-heart"></i> COSECHAR</button>` :
                                `<div class="flex gap-x-2">
                                    <button onclick="waterPlot(${i})" class="flex-1 py-2 text-xs font-extrabold bg-sky-100 hover:bg-sky-200 text-sky-700 rounded-3xl flex items-center justify-center gap-x-1.5"><i class="fa-solid fa-tint"></i> <span>Regar</span></button>
                                    <!-- Proteger button removed - protection is now global via Espantapájaros upgrade -->
                                    <button onclick="removePlant(${i}, event)" class="px-3 py-2 text-xs font-extrabold bg-red-100 hover:bg-red-200 text-red-600 rounded-3xl flex items-center justify-center active:scale-90 transition-transform" title="Quitar planta"><i class="fa-solid fa-trash"></i></button>
                                </div>`
                            }
                        </div>
                    `;
                }
                card.innerHTML = html;
                container.appendChild(card);
            }
        }

        function startLiveUpdate() {
            setInterval(() => {
                if (!document.getElementById('content-farm').classList.contains('hidden')) renderPlots();
            }, 2500);
        }

        // ==================== ACTIONS ====================
        function plantBerry(plotIndex, type) {
            const plot = gameState.plots[plotIndex];
            if (!plot || plot.type) return;
            
            const berry = berryTypes[type];
            
            // Permanent plant - no seed consumption for now (we'll sell the plant itself)
            plot.type = type;
            plot.plantedAt = Date.now();
            plot.lastWatered = Date.now();
            plot.lastHarvest = Date.now(); // Can harvest immediately after planting for first time
            plot.hasPest = false;
            
            saveGame();
            renderPlots();
            
            // Small shovel animation
            setTimeout(() => {
                const cards = document.querySelectorAll('#plots-grid > div');
                if (cards[plotIndex]) {
                    const shovel = document.createElement('div');
                    shovel.className = 'absolute text-4xl z-50 pointer-events-none';
                    shovel.style.left = '50%';
                    shovel.style.top = '40%';
                    shovel.style.transform = 'translate(-50%, -50%)';
                    shovel.innerHTML = '🪏';
                    cards[plotIndex].appendChild(shovel);
                    
                    setTimeout(() => {
                        shovel.style.transition = 'all 0.35s ease';
                        shovel.style.transform = 'translate(-50%, 30px) rotate(20deg)';
                        shovel.style.opacity = '0';
                        setTimeout(() => shovel.remove(), 300);
                    }, 120);
                }
            }, 80);
            
            showToast(`¡Plantaste ${berry.name}!`, 'success');
        }

        function harvestPlot(index, event) {
            const plot = gameState.plots[index];
            if (!plot.type) return;
            
            const berry = berryTypes[plot.type];
            const now = Date.now();
            
            const lastHarvest = plot.lastHarvest || plot.plantedAt || now;
            const timeSinceHarvest = now - lastHarvest;
            
            if (timeSinceHarvest < berry.harvestCooldown) {
                const remainingHours = Math.ceil((berry.harvestCooldown - timeSinceHarvest) / (1000 * 60 * 60));
                return showToast(`Faltan ~${remainingHours}h para la próxima cosecha`, "error");
            }
            
            let reward = berry.harvestReward;
            
            // Penalties for bad maintenance (crows + pests)
            if (plot.hasPest) reward *= 0.5;
            if (!plot.lastWatered || (now - plot.lastWatered) > (berry.harvestCooldown * 1.8)) {
                reward *= 0.35;
            }
            // ==================== VENDER PLANTA ====================
function sellPlant(index) {
    const plot = gameState.plots[index];
    if (!plot || !plot.type) return;

    const plantType = plot.type;
    const plantData = berryTypes[plantType];
    if (!plantData) return;

    // Precio original de la planta
    const originalPrice = plantData.price;
    
    // 70% de devolución
    const sellValue = Math.floor(originalPrice * 0.70);

    // Confirmación
    if (!confirm(`¿Quieres vender tu ${plantData.name}?\n\nRecibirás: $${sellValue} USDC (70% del valor)`)) {
        return;
    }

    // Dar el dinero al jugador
    gameState.usdc += sellValue;

    // Quitar la planta
    plot.type = null;
    plot.plantedAt = null;
    plot.lastWatered = null;
    plot.lastHarvest = null;
    plot.hasPest = false;
    plot.isWelcomePlant = false;

    saveGame();
    updateBalances();
    renderPlots();

    showToast(`Vendiste ${plantData.name} → +$${sellValue} USDC`, 'success');
}
            // Global Espantapájaros upgrade protects all plants
            if (gameState.upgrades && gameState.upgrades.hasScarecrow) {
                reward = berry.harvestReward * 0.93; // Only ~7% loss
            }
            
            reward = Math.max(0.05, parseFloat(reward.toFixed(2)));
            
            gameState.usdc += reward;
            
            updateMissionProgress('harvest_plants', 1);
            
            const rect = event.target.getBoundingClientRect();
            createFloatingReward(`+${reward} USDC`, rect.left + 30, rect.top - 15);
            
            plot.lastHarvest = now;
            plot.hasPest = false;
            
            saveGame();
            updateBalances();
            renderPlots();
            showToast(`Cosechaste ${berry.name} → +${reward} USDC`, 'success');
        }

        function harvestAll() {
            let total = 0, count = 0;
            const now = Date.now();
            
            gameState.plots.forEach(plot => {
                if (plot.type && plot.plantedAt) {
                    const progress = Math.min(100, ((now - plot.plantedAt) / plot.growthDuration) * 100);
                    if (progress >= 100) {
                        const berry = berryTypes[plot.type];
                        let y = berry.yield;
                        if (plot.hasPest) y *= 0.55;
                        if (!plot.lastWatered || (now - plot.lastWatered) > plot.growthDuration * 1.3) y *= 0.45;
                        
                        gameState.usdc += y;
                        total += y; count++;
                        
                        plot.type = null; plot.plantedAt = null; plot.lastWatered = null; plot.hasPest = false;
                    }
                }
            });
            
            if (count > 0) {
                updateMissionProgress('harvest_plants', count);
                saveGame(); updateBalances(); renderPlots();
                showToast(`¡Cosechaste ${count} plantas! +${total} USDC`, 'success');
            } else showToast("No hay plantas listas", "error");
        }

        function waterPlot(index) {
            const plot = gameState.plots[index];
            if (!plot.type) return;
            
            const plantData = berryTypes[plot.type];
            
            // If plant doesn't need water, don't consume it
            if (plantData && plantData.noWater) {
                plot.lastWatered = Date.now();
                showToast("Esta planta no necesita agua.", 'success');
                renderPlots();
                return;
            }
            
            if (gameState.water <= 0) return showToast("No tienes agua. Compra o mira videos.", "error");
            
            const hasPremiumWatering = gameState.upgrades && gameState.upgrades.premiumWateringCan;
            const hasBetterWatering = gameState.upgrades && gameState.upgrades.betterWateringCan;
            
            gameState.water--;
            plot.lastWatered = Date.now();
            
            if (hasPremiumWatering) {
                // Premium: Water ALL plants with just 1 water
                for (let i = 0; i < gameState.unlockedPlots; i++) {
                    if (gameState.plots[i].type) {
                        gameState.plots[i].lastWatered = Date.now();
                    }
                }
                updateMissionProgress('water_plants', gameState.unlockedPlots);
                saveGame();
                updateBalances();
                renderPlots();
                showToast("¡Todas tus plantas regadas con 1 agua!", 'success');
                return;
            }
            
            // Normal Better Watering Can (waters 2 plants)
            if (hasBetterWatering) {
                const emptyPlots = [];
                for (let i = 0; i < gameState.unlockedPlots; i++) {
                    if (i !== index && gameState.plots[i].type && !gameState.plots[i].lastWatered) {
                        emptyPlots.push(i);
                    }
                }
                if (emptyPlots.length > 0) {
                    const randomIndex = emptyPlots[Math.floor(Math.random() * emptyPlots.length)];
                    gameState.plots[randomIndex].lastWatered = Date.now();
                }
            }
            
            updateMissionProgress('water_plants', 1);
            
            saveGame();
            updateBalances();
            renderPlots();
            
            if (hasBetterWatering) {
                showToast("¡Dos plantas regadas!", 'success');
            } else {
                showToast("¡Planta regada!", 'success');
            }
        }

        function applyInsumo(index) {
            const plot = gameState.plots[index];
            if (!plot.type || gameState.insumos <= 0) return showToast("No tienes insumos", "error");
            
            gameState.insumos--;
            if (plot.hasPest) plot.hasPest = false;
            saveGame(); renderPlots();
            showToast("¡Planta protegida contra plagas!", 'success');
        }

        // applyScarecrow removed - now using global permanent upgrade

        function removePlant(index, event) {
            const plot = gameState.plots[index];
            if (!plot.type) return;
            
            // Nicer confirmation
            if (!confirm(`¿Seguro que quieres quitar la ${berryTypes[plot.type]?.name || 'planta'}?\nNo recuperarás nada.`)) {
                return;
            }
            
            // Shovel animation
            const rect = event.currentTarget ? event.currentTarget.getBoundingClientRect() : event.target.getBoundingClientRect();
            const shovel = document.createElement('div');
            shovel.className = 'fixed text-5xl z-[999] pointer-events-none';
            shovel.style.left = `${rect.left}px`;
            shovel.style.top = `${rect.top}px`;
            shovel.innerHTML = '🪏';
            document.body.appendChild(shovel);
            
            setTimeout(() => {
                shovel.style.transition = 'all 0.45s ease';
                shovel.style.transform = 'translateY(70px) rotate(30deg)';
                shovel.style.opacity = '0';
                
                setTimeout(() => {
                    shovel.remove();
                    
                    // Remove plant
                    plot.type = null;
                    plot.plantedAt = null;
                    plot.lastWatered = null;
                    plot.lastHarvest = null;
                    plot.hasPest = false;
                    
                    saveGame();
                    renderPlots();
                    showToast("Planta quitada", 'success');
                }, 380);
            }, 60);
        }

        // ==================== WATCH VIDEO → AGUA ====================
        function watchVideoForWater(waterAmount, durationSeconds, buttonElement) {
            if (gameState.stats.videosWatchedToday >= MAX_VIDEOS_PER_DAY) {
                showToast(`Ya viste los ${MAX_VIDEOS_PER_DAY} videos de hoy`, "error");
                return;
            }
            
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/80 flex items-center justify-center z-[500]`;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl w-full max-w-md mx-4 overflow-hidden">
                    <div class="bg-sky-900 px-6 py-4 flex items-center justify-between text-white">
                        <div class="font-extrabold">Reproduciendo video...</div>
                        <div class="font-mono text-lg font-bold" id="video-timer">${durationSeconds}</div>
                    </div>
                    
                    <div class="fake-video h-48 flex items-center justify-center">
                        <i class="fa-solid fa-play text-white text-6xl opacity-70"></i>
                    </div>
                    
                    <div class="p-6 text-center">
                        <div class="font-extrabold text-2xl text-sky-600">+${waterAmount} Agua</div>
                        <div class="text-sm text-sky-500 mt-1">Para regar tus plantas</div>
                        
                        <button id="claim-video-btn" disabled class="mt-5 w-full py-3.5 bg-sky-600 text-white font-extrabold rounded-3xl opacity-50">
                            Esperando que termine el video...
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            let timeLeft = durationSeconds;
            const timerEl = modal.querySelector('#video-timer');
            const claimBtn = modal.querySelector('#claim-video-btn');
            
            const interval = setInterval(() => {
                timeLeft--;
                timerEl.textContent = timeLeft;
                
                if (timeLeft <= 0) {
                    clearInterval(interval);
                    claimBtn.disabled = false;
                    claimBtn.classList.remove('opacity-50');
                    claimBtn.innerHTML = `Reclamar +${waterAmount} Agua`;
                    
                    claimBtn.onclick = () => {
                        gameState.water += waterAmount;
                        gameState.stats.videosWatchedToday = (gameState.stats.videosWatchedToday || 0) + 1;
                        
                        updateMissionProgress('watch_videos', 1);
                        
                        saveGame();
                        updateBalances();
                        modal.remove();
                        showToast(`¡Gracias! +${waterAmount} Agua añadida`, 'success');
                    };
                }
            }, 1000);
        }

        // ==================== BUY WITH USDC ====================
        async function buyWithUSDC(itemName, usdcAmount, itemType, qty) {
            if (!gameState.wallet) {
                showToast("Primero conecta tu wallet Phantom", "error");
                return;
            }

            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/70 flex items-center justify-center z-[400]`;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl w-full max-w-md mx-4 p-7">
                    <div class="text-center mb-6">
                        <i class="fa-brands fa-solana text-5xl text-emerald-500 mb-3"></i>
                        <div class="font-extrabold text-2xl">Confirmar compra</div>
                        <div class="text-emerald-600 mt-1">${itemName}</div>
                    </div>
                    
                    <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
                        <div class="flex justify-between items-center">
                            <div>
                                <div class="text-sm text-emerald-600">Total a pagar</div>
                                <div class="font-black text-4xl text-emerald-700">${usdcAmount} <span class="text-2xl">USDC</span></div>
                            </div>
                            <div class="text-right">
                                <div class="text-xs text-emerald-500">Red</div>
                                <div class="font-extrabold text-emerald-600">Solana</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-x-3">
                        <button onclick="this.closest('.fixed').remove()" class="flex-1 py-3.5 border border-slate-300 text-slate-600 font-extrabold rounded-3xl">Cancelar</button>
                        
                        <button onclick="confirmUSDCTransaction(${usdcAmount}, '${itemType}', ${qty}, this)" 
                                class="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-3xl flex items-center justify-center gap-x-2">
                            <i class="fa-brands fa-solana"></i>
                            <span>Confirmar y Pagar</span>
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }

        async function confirmUSDCTransaction(usdcAmount, itemType, qty, btn) {
            const modal = btn.closest('.fixed');
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...`;
            btn.disabled = true;

            try {
                await new Promise(resolve => setTimeout(resolve, 1600));
                
                if (itemType.startsWith('seeds_')) {
                    const t = itemType.split('_')[1];
                    gameState.seeds[t] = (gameState.seeds[t] || 0) + qty;
                } else if (itemType === 'insumos') {
                    gameState.insumos = (gameState.insumos || 0) + qty;
                }
                
                saveGame();
                modal.remove();
                showToast(`¡Compra exitosa!`, 'success');
                
            } catch (error) {
                btn.innerHTML = `Error - Reintentar`;
                btn.disabled = false;
            }
        }

        async function buyNewPlotWithUSDC() {
            if (!TESTING_MODE && !gameState.wallet) {
                showToast("Primero conecta tu wallet Phantom", "error");
                return;
            }
            
            const cost = PLOT_COSTS_USDC[gameState.unlockedPlots];
            if (!cost) return showToast("Máximo de parcelas alcanzado", "error");
            
            await buyWithUSDC(`Parcela Extra #${gameState.unlockedPlots + 1}`, cost, 'plot', 1);
            
            setTimeout(() => {
                if (gameState.unlockedPlots < MAX_PLOTS) {
                    gameState.unlockedPlots++;
                    saveGame();
                    renderPlots();
                    showToast(`¡Parcela desbloqueada!`, 'success');
                }
            }, 2000);
        }

        function buyWater(amount, usdcCost) {
            if (!TESTING_MODE && !gameState.wallet) {
                showToast("Conecta Phantom para comprar", "error");
                return;
            }
            if (gameState.usdc < usdcCost) {
                showToast("No tienes suficiente USDC", "error");
                return;
            }
            
            gameState.usdc -= usdcCost;
            gameState.water += amount;
            saveGame();
            updateBalances();
            showToast(`¡Compraste ${amount} de agua!`, 'success');
        }

        function buyPermanentPlant(plantType, usdcCost) {
            if (!TESTING_MODE && !gameState.wallet) {
                showToast("Conecta Phantom para comprar", "error");
                return;
            }
            if (gameState.usdc < usdcCost) {
                showToast("No tienes suficiente USDC", "error");
                return;
            }
            
            // Find first empty unlocked plot
            let emptyPlotIndex = -1;
            for (let i = 0; i < gameState.unlockedPlots; i++) {
                if (!gameState.plots[i].type) {
                    emptyPlotIndex = i;
                    break;
                }
            }
            
            if (emptyPlotIndex === -1) {
                return showToast("No tienes parcelas vacías. Compra más parcelas.", "error");
            }
            
            gameState.usdc -= usdcCost;
            
            const plot = gameState.plots[emptyPlotIndex];
            plot.type = plantType;
            plot.plantedAt = Date.now();
            plot.lastWatered = Date.now();
            plot.lastHarvest = Date.now();
            plot.hasPest = false;
            
            saveGame();
            updateBalances();
            renderPlots();
            showToast(`¡Compraste ${berryTypes[plantType].name}!`, 'success');
        }

        function buyRaidTool(toolType, usdcCost) {
            if (!TESTING_MODE && !gameState.wallet) {
                showToast("Conecta Phantom para comprar", "error");
                return;
            }
            if (gameState.usdc < usdcCost) {
                showToast("No tienes suficiente USDC", "error");
                return;
            }
            
            gameState.usdc -= usdcCost;
            
            if (toolType === 'dogBone') {
                gameState.raidTools.dogBone = (gameState.raidTools.dogBone || 0) + 1;
                showToast("¡Compraste Hueso para Perro! Úsalo en granjas de alto peligro.", 'success');
            } else if (toolType === 'stealthKit') {
                gameState.raidTools.stealthKit = (gameState.raidTools.stealthKit || 0) + 1;
                showToast("¡Kit de Sigilo comprado! +22% éxito en próximo asalto.", 'success');
            }
            
            saveGame();
            updateBalances();
        }

        function buyUpgrade(upgradeType, usdcCost) {
            if (!TESTING_MODE && !gameState.wallet) {
                showToast("Conecta Phantom para comprar", "error");
                return;
            }
            if (gameState.usdc < usdcCost) {
                showToast("No tienes suficiente USDC", "error");
                return;
            }
            
            if (gameState.upgrades && gameState.upgrades[upgradeType]) {
                showToast("Ya tienes esta mejora", "error");
                return;
            }
            
            gameState.usdc -= usdcCost;
            
            if (!gameState.upgrades) gameState.upgrades = {};
            gameState.upgrades[upgradeType] = true;
            
            saveGame();
            updateBalances();
            showToast("¡Mejora comprada! Ahora puedes regar 2 plantas a la vez.", 'success');
        }

        function buyPermanentScarecrow(usdcCost) {
            if (!TESTING_MODE && !gameState.wallet) {
                showToast("Conecta Phantom para comprar", "error");
                return;
            }
            if (gameState.usdc < usdcCost) {
                showToast("No tienes suficiente USDC", "error");
                return;
            }
            
            if (gameState.upgrades && gameState.upgrades.hasScarecrow) {
                return showToast("Ya tienes el Espantapájaros permanente.", "error");
            }
            
            gameState.usdc -= usdcCost;
            
            if (!gameState.upgrades) gameState.upgrades = {};
            gameState.upgrades.hasScarecrow = true;
            
            saveGame();
            updateBalances();
            showToast("¡Espantapájaros permanente comprado! Todas tus plantas están protegidas.", 'success');
        }

        // ==================== REFERRAL SYSTEM ====================
        function generateReferralCode(wallet) {
            if (!wallet) return "BERRY" + Math.floor(Math.random() * 9999);
            return "BERRY" + wallet.substring(2, 8).toUpperCase();
        }

        function updateReferralUI() {
            const codeEl = document.getElementById('referral-code');
            const countEl = document.getElementById('referral-count');
            const earnedEl = document.getElementById('referral-earned');
            
            if (!gameState.wallet) {
                if (codeEl) codeEl.textContent = "Conecta wallet primero";
                return;
            }
            
            if (!gameState.referralCode) {
                gameState.referralCode = generateReferralCode(gameState.wallet);
                saveGame();
            }
            
            if (codeEl) codeEl.textContent = gameState.referralCode;
            if (countEl) countEl.textContent = gameState.referredUsers || 0;
            if (earnedEl) earnedEl.textContent = (gameState.referralEarnings || 0).toFixed(2);
        }

        function copyReferralCode() {
            if (!gameState.referralCode) return;
            navigator.clipboard.writeText(gameState.referralCode).then(() => {
                showToast("Código copiado al portapapeles", 'success');
            });
        }

        function claimReferralBonus() {
            const input = document.getElementById('referral-input');
            const code = input.value.trim().toUpperCase();
            
            if (!code) {
                showToast("Ingresa un código", "error");
                return;
            }
            
            if (!gameState.wallet) {
                showToast("Primero conecta tu wallet", "error");
                return;
            }
            
            if (gameState.referredBy) {
                showToast("Ya usaste un código de referido", "error");
                return;
            }
            
            if (code === gameState.referralCode) {
                showToast("No puedes usar tu propio código", "error");
                return;
            }
            
            gameState.usdc += 1.5;
            gameState.referredBy = code;
            
            saveGame();
            updateBalances();
            
            showToast("¡Bienvenido! +4 USDC por usar el código", 'success');
            input.value = "";
        }

        // ==================== WITHDRAWALS ====================
        function updateWithdrawalUI() {
            const balanceEl = document.getElementById('withdrawable-balance');
            if (balanceEl) balanceEl.textContent = gameState.usdc.toFixed(2);
            
            const nextEl = document.getElementById('next-withdrawal');
            if (!nextEl) return;
            
            if (!gameState.lastWithdrawal) {
                nextEl.textContent = "Disponible ahora";
                nextEl.className = "font-extrabold text-2xl text-emerald-600";
                return;
            }
            
            const last = new Date(gameState.lastWithdrawal);
            const nextDate = new Date(last.getTime() + (WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000));
            const now = new Date();
            
            if (now >= nextDate) {
                nextEl.textContent = "Disponible ahora";
                nextEl.className = "font-extrabold text-2xl text-emerald-600";
            } else {
                const diffDays = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                nextEl.textContent = `En ${diffDays} día${diffDays > 1 ? 's' : ''}`;
                nextEl.className = "font-extrabold text-2xl text-orange-600";
            }
            
            renderWithdrawalHistory();
        }

        function renderWithdrawalHistory() {
            const container = document.getElementById('withdrawal-history');
            if (!container) return;
            
            if (!gameState.withdrawalHistory || gameState.withdrawalHistory.length === 0) {
                container.innerHTML = `<div class="text-slate-400 text-sm">Aún no has realizado ningún retiro.</div>`;
                return;
            }
            
            let html = '';
            gameState.withdrawalHistory.slice().reverse().forEach(w => {
                html += `
                    <div class="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-2xl">
                        <div>
                            <div class="font-extrabold">${w.amount} USDC</div>
                            <div class="text-xs text-slate-500">${new Date(w.date).toLocaleDateString('es-CL')}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs px-3 py-0.5 rounded-full ${w.status === 'Completado' ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'}">${w.status}</div>
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }

        function requestWithdrawal() {
            if (!gameState.wallet) {
                showToast("Primero conecta tu wallet Phantom", "error");
                return;
            }
            
            if (gameState.lastWithdrawal) {
                const last = new Date(gameState.lastWithdrawal);
                const nextDate = new Date(last.getTime() + (WITHDRAWAL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000));
                if (new Date() < nextDate) {
                    const diffDays = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24));
                    showToast(`Debes esperar ${diffDays} día${diffDays > 1 ? 's' : ''} para el próximo retiro`, "error");
                    return;
                }
            }
            
            if (gameState.usdc < 5) {
                showToast("El monto mínimo para retirar es 5 USDC", "error");
                return;
            }
            
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/70 flex items-center justify-center z-[400]`;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl w-full max-w-md mx-4 p-7">
                    <div class="font-extrabold text-2xl mb-1">Solicitar Retiro</div>
                    <div class="text-sm text-slate-500 mb-6">Se enviará a tu wallet de Solana</div>
                    
                    <div class="mb-4">
                        <div class="text-xs text-emerald-600 font-bold mb-1">Monto a retirar</div>
                        <input id="withdraw-amount" type="number" value="${gameState.usdc.toFixed(2)}" step="0.01" 
                               class="w-full px-5 py-3 text-2xl font-extrabold border border-emerald-200 rounded-3xl focus:outline-none">
                    </div>
                    
                    <div class="mb-6">
                        <div class="text-xs text-emerald-600 font-bold mb-1">Wallet de destino</div>
                        <input id="withdraw-wallet" type="text" value="${gameState.wallet || ''}" 
                               class="w-full px-5 py-3 font-mono text-sm border border-emerald-200 rounded-3xl focus:outline-none">
                    </div>
                    
                    <div class="flex gap-x-3">
                        <button onclick="this.closest('.fixed').remove()" class="flex-1 py-3.5 border border-slate-300 text-slate-600 font-extrabold rounded-3xl">Cancelar</button>
                        <button onclick="confirmWithdrawal(this)" class="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-3xl">Confirmar Solicitud</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }

        function confirmWithdrawal(btn) {
            const modal = btn.closest('.fixed');
            const amountInput = document.getElementById('withdraw-amount');
            const walletInput = document.getElementById('withdraw-wallet');
            
            const amount = parseFloat(amountInput.value);
            const wallet = walletInput.value.trim();
            
            if (!amount || amount < 5) { showToast("Mínimo 5 USDC", "error"); return; }
            if (amount > gameState.usdc) { showToast("Saldo insuficiente", "error"); return; }
            if (!wallet) { showToast("Ingresa tu wallet", "error"); return; }
            
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Procesando...`;
            btn.disabled = true;
            
            setTimeout(() => {
                gameState.usdc -= amount;
                gameState.lastWithdrawal = new Date().toISOString();
                
                if (!gameState.withdrawalHistory) gameState.withdrawalHistory = [];
                gameState.withdrawalHistory.push({
                    date: new Date().toISOString(),
                    amount: amount.toFixed(2),
                    status: "Pendiente"
                });
                
                saveGame();
                updateBalances();
                updateWithdrawalUI();
                modal.remove();
                
                showToast(`Solicitud de retiro por ${amount} USDC enviada`, 'success');
            }, 1200);
        }

        // ==================== OTHER ====================
        function showPlantModal(plotIndex) {
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[200]`;
            
            let html = `<div onclick="event.target.remove()" class="absolute inset-0"></div>
                <div class="modal-content bg-white w-full md:w-[440px] rounded-t-3xl md:rounded-3xl p-6 relative">
                    <div class="flex justify-between mb-5"><div class="font-extrabold text-2xl">¿Qué quieres plantar?</div><button onclick="this.closest('.fixed').remove()" class="text-4xl text-slate-300">×</button></div>
                    <div class="space-y-3">`;
            
            Object.keys(berryTypes).forEach(key => {
                const b = berryTypes[key];
                const have = gameState.seeds[key] || 0;
                html += `
                    <button onclick="plantFromModal(${plotIndex}, '${key}', this)" class="w-full flex justify-between items-center px-5 py-[17px] rounded-3xl border ${have > 0 ? 'border-emerald-200 hover:bg-emerald-50' : 'opacity-40 border-slate-200 cursor-not-allowed'}">
                        <div class="flex items-center gap-x-4"><span class="text-4xl">${b.emoji}</span><div><div class="font-extrabold">${b.name}</div><div class="text-xs text-emerald-500">${Math.round(b.growthTime/3600000)}h • +${b.yield} USDC</div></div></div>
                        <div class="font-mono text-sm font-extrabold ${have > 0 ? 'text-emerald-600' : 'text-slate-400'}">${have} semillas</div>
                    </button>`;
            });
            
            html += `</div></div>`;
            modal.innerHTML = html;
            document.body.appendChild(modal);
        }

        function plantFromModal(plotIndex, type, btn) {
            btn.closest('.fixed').remove();
            plantBerry(plotIndex, type);
        }

        function claimDailyBonus() {
            const today = new Date().toDateString();
            
            if (gameState.lastLoginDate === today && gameState.lastStreakClaim === today) {
                showToast("Ya reclamaste el bonus de hoy", "error");
                return;
            }
            
            gameState.usdc += 1.5;
            gameState.water += 18;
            gameState.seeds.strawberry = (gameState.seeds.strawberry || 0) + 2;
            
            checkAndUpdateStreak();
            updateStreakDisplay();
            
            saveGame();
            updateBalances();
            showToast("¡Bonus diario! +4 USDC + 25 Agua", 'success');
        }

        function switchTab(tab) {
            document.querySelectorAll('[id^="content-"]').forEach(el => el.classList.add('hidden'));
            document.getElementById(`content-${tab}`).classList.remove('hidden');

            // Reset all tabs
            document.querySelectorAll('[id^="tab-"]').forEach(el => {
                el.classList.remove('active', 'text-white', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-600', 'bg-amber-600', 'bg-cyan-600', 'bg-slate-600', 'bg-purple-600');
            });

            const tabEl = document.getElementById(`tab-${tab}`);
            if (!tabEl) return;

            // All tabs now use the same green pill style like Granja (reliable)
            tabEl.classList.add('active', 'bg-emerald-600', 'text-white');

            // Side effects
            if (tab === 'referrals') setTimeout(updateReferralUI, 50);
            if (tab === 'withdrawals') setTimeout(updateWithdrawalUI, 50);
            if (tab === 'missions') setTimeout(() => { renderMissions(); updateStreakDisplay(); }, 50);
            if (tab === 'explore') setTimeout(renderAbandonedFarms, 50);
        }

        async function connectPhantomWallet() {
            if (!window.solana || !window.solana.isPhantom) {
                showToast("Phantom no está instalado", "error");
                return;
            }
            try {
                const resp = await window.solana.connect();
                gameState.wallet = resp.publicKey.toString();
                
                const btnContainer = document.getElementById('wallet-section');
                btnContainer.innerHTML = `
                    <div onclick="disconnectWallet()" class="flex items-center gap-x-2.5 px-4 py-2 bg-emerald-100 border border-emerald-300 rounded-3xl cursor-pointer">
                        <div class="flex items-center gap-x-2">
                            <i class="fa-brands fa-solana text-emerald-600"></i>
                            <div>
                                <div class="font-mono text-xs text-emerald-700 font-bold">${gameState.wallet.substring(0,4)}...${gameState.wallet.slice(-4)}</div>
                            </div>
                        </div>
                    </div>
                `;
                showToast("Wallet conectada", 'success');
                updateReferralUI();
            } catch (err) {
                showToast("Error al conectar", "error");
            }
        }

        function disconnectWallet() {
            if (window.solana) window.solana.disconnect();
            gameState.wallet = null;
            const btnContainer = document.getElementById('wallet-section');
            btnContainer.innerHTML = `
                <button onclick="connectPhantomWallet()" class="flex items-center gap-x-2.5 px-5 py-2 bg-gradient-to-r from-purple-600 to-violet-600 text-white font-extrabold rounded-3xl text-sm">
                    <i class="fa-solid fa-wallet mr-2"></i>
                    <span>Conectar Phantom</span>
                </button>
            `;
        }

        // ==================== ABANDONED FARMS / RAIDING SYSTEM ====================
        function generateAbandonedFarms() {
            const now = Date.now();
            const farmNames = [
                "Finca El Roble", "Granja de Martín", "Campo de la Abuela", 
                "Huerto San Pedro", "Finca Los Pinos", "Granja El Silencio",
                "Parcela del Norte", "Huerto Viejo", "Finca La Esperanza"
            ];
            
            gameState.abandonedFarms = [];
            
            for (let i = 0; i < 6; i++) {
                const dangerLevel = Math.random();
                let danger = "bajo";
                let successChance = 0.85;
                let rewardMultiplier = 1.0;
                
                if (dangerLevel > 0.75) {
                    danger = "alto";
                    successChance = 0.48;
                    rewardMultiplier = 2.2;
                } else if (dangerLevel > 0.45) {
                    danger = "medio";
                    successChance = 0.68;
                    rewardMultiplier = 1.5;
                }
                
                // Loot system - Raiding gives random items (not direct USDC money)
                const availablePlants = Math.floor(Math.random() * 2) + 1;
                
                // Assign plant type for ADN drops
                const plantTypes = ['baby', 'basic', 'rapid', 'premium', 'elite'];
                const plantType = plantTypes[Math.floor(Math.random() * plantTypes.length)];
                
                // ADN drop chance based on plant rarity
                const adnChances = {
                    'baby': 38,
                    'basic': 28,
                    'rapid': 25,
                    'premium': 14,
                    'elite': 5
                };
                
                let possibleLoot = [];
                
                if (danger === "alto") {
                    // High danger = best loot but hardest
                    possibleLoot = [
                        { type: 'water', amount: 8, chance: 35 },
                        { type: 'insumo', amount: 2, chance: 25 },
                        { type: 'dogBone', amount: 1, chance: 18 },
                        { type: 'stealthKit', amount: 1, chance: 12 },
                        { type: 'extraPlot', amount: 1, chance: 5 }, // 5% chance of extra plot
                        { type: 'water', amount: 15, chance: 5 }
                    ];
                } else if (danger === "medio") {
                    possibleLoot = [
                        { type: 'water', amount: 5, chance: 45 },
                        { type: 'insumo', amount: 1, chance: 30 },
                        { type: 'dogBone', amount: 1, chance: 15 },
                        { type: 'water', amount: 10, chance: 10 }
                    ];
                } else {
                    // Low danger = basic loot only
                    possibleLoot = [
                        { type: 'water', amount: 3, chance: 60 },
                        { type: 'insumo', amount: 1, chance: 25 },
                        { type: 'water', amount: 6, chance: 15 }
                    ];
                }
                
                gameState.abandonedFarms.push({
                    id: i,
                    name: farmNames[Math.floor(Math.random() * farmNames.length)],
                    danger: danger,
                    successChance: successChance,
                    possibleLoot: possibleLoot,
                    plantsLeft: availablePlants,
                    lastRaided: null,
                    plantType: plantType,
                    adnChance: adnChances[plantType] || 20
                });
            }
            
            gameState.lastFarmsRefresh = now;
            saveGame();
        }

        function getTimeUntilFarmsRefresh() {
            if (!gameState.lastFarmsRefresh) return "6h 00m";
            
            const nextRefresh = gameState.lastFarmsRefresh + (6 * 60 * 60 * 1000); // 6 hours
            const remaining = nextRefresh - Date.now();
            
            if (remaining <= 0) {
                generateAbandonedFarms();
                return "6h 00m";
            }
            
            const hours = Math.floor(remaining / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m`;
        }

        function renderAbandonedFarms() {
            const container = document.getElementById('abandoned-farms-grid');
            if (!container) return;
            
            // Refresh farms if needed
            if (!gameState.lastFarmsRefresh || 
                (Date.now() - gameState.lastFarmsRefresh) > (6 * 60 * 60 * 1000)) {
                generateAbandonedFarms();
            }
            
            if (!gameState.abandonedFarms || gameState.abandonedFarms.length === 0) {
                generateAbandonedFarms();
            }
            
            let html = '';
            
            gameState.abandonedFarms.forEach(farm => {
                const dangerColor = farm.danger === 'alto' ? 'text-red-600 bg-red-100' : 
                                   farm.danger === 'medio' ? 'text-orange-600 bg-orange-100' : 
                                   'text-emerald-600 bg-emerald-100';
                
                const dangerLabel = farm.danger === 'alto' ? 'Alto' : 
                                   farm.danger === 'medio' ? 'Medio' : 'Bajo';
                
                const canRaid = !gameState.raidCooldownUntil || Date.now() > gameState.raidCooldownUntil;
                
                html += `
                    <div class="berry-card bg-white border border-orange-200 rounded-3xl p-5">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <div class="font-extrabold text-lg">${farm.name}</div>
                                <div class="text-xs text-slate-500">${farm.plantsLeft} plantas con fruta</div>
                            </div>
                            <div class="px-3 py-1 rounded-2xl text-xs font-extrabold ${dangerColor}">
                                Peligro ${dangerLabel}
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <div class="flex justify-between text-xs mb-1">
                                <span class="text-slate-500">Probabilidad de éxito</span>
                                <span class="font-extrabold text-emerald-600">${Math.floor(farm.successChance * 100)}%</span>
                            </div>
                            <div class="h-2 bg-orange-100 rounded-full overflow-hidden">
                                <div class="h-2 bg-orange-500" style="width: ${farm.successChance * 100}%"></div>
                            </div>
                        </div>

                        <!-- ADN Drop Chance -->
                        <div class="mb-3 bg-purple-50 border border-purple-100 rounded-2xl px-3 py-2 text-xs">
                            <div class="flex justify-between items-center">
                                <span class="text-purple-700 font-bold">🧬 ADN al saquear</span>
                                <span class="font-extrabold ${farm.adnChance <= 10 ? 'text-amber-600' : 'text-purple-600'}">${farm.adnChance || 20}%</span>
                            </div>
                            <div class="text-[10px] text-purple-600 mt-0.5">Pieza de ADN de ${farm.plantType ? berryTypes[farm.plantType]?.name : 'planta'}</div>
                        </div>
                        
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <div class="text-xs text-slate-500">Posible botín</div>
                                <div class="font-extrabold text-emerald-600">
                                    ${farm.danger === 'alto' ? 'Mejor botín (riesgo alto)' : 
                                      farm.danger === 'medio' ? 'Botín decente' : 'Botín básico'}
                                </div>
                            </div>
                            
                            <button onclick="attemptRaid(${farm.id})" 
                                    class="px-6 py-2.5 ${canRaid ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'} font-extrabold rounded-3xl text-sm active:scale-[0.985]">
                                ${canRaid ? 'Asaltar' : 'En cooldown'}
                            </button>
                        </div>
                        
                        <div class="text-[10px] text-slate-400">
                            ${farm.danger === 'alto' ? '⚠️ Alto riesgo de que te atrapen' : 
                              farm.danger === 'medio' ? 'Riesgo moderado' : 'Bajo riesgo'}
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
            
            // Update refresh timer
            const timerEl = document.getElementById('farms-refresh-timer');
            if (timerEl) timerEl.textContent = getTimeUntilFarmsRefresh();
        }

        function attemptRaid(farmId) {
            const farm = gameState.abandonedFarms.find(f => f.id === farmId);
            if (!farm) return;
            
            // Check cooldown
            if (gameState.raidCooldownUntil && Date.now() < gameState.raidCooldownUntil) {
                const remaining = Math.ceil((gameState.raidCooldownUntil - Date.now()) / (1000 * 60));
                showToast(`Debes esperar ${remaining} minutos para volver a asaltar`, "error");
                return;
            }
            
            // TEMPORAL: Wallet check disabled for testing
            // if (!gameState.wallet) {
            //     showToast("Conecta tu wallet para asaltar", "error");
            //     return;
            // }

            // Show animated raid modal instead of instant result
            showRaidAnimationModal(farm);
            
            // Calculate success chance with tools
            let finalChance = farm.successChance;
            
            // Apply tools if available
            if (gameState.raidTools.stealthKit > 0) {
                finalChance += 0.22;
                gameState.raidTools.stealthKit--;
            }
            if (gameState.raidTools.dogBone > 0 && farm.danger === 'alto') {
                finalChance += 0.28;
                gameState.raidTools.dogBone--;
            }
            
            finalChance = Math.min(0.95, finalChance);
            
            const success = Math.random() < finalChance;
            
            if (success) {
                // Success - get reward
                const reward = farm.potentialReward;
                gameState.usdc += reward;
                
                farm.plantsLeft = Math.max(0, farm.plantsLeft - 1);
                if (farm.plantsLeft <= 0) {
                    farm.potentialReward = Math.floor(farm.potentialReward * 0.6);
                }
                
                // === ADN Drop from raided farm (Laboratory system) - Rare drops ===
                if (farm.plantType) {
                    const adnDropChance = {
                        'baby': 0.38,      // ~38% chance (decent but not guaranteed)
                        'basic': 0.28,
                        'rapid': 0.25,
                        'premium': 0.14,
                        'elite': 0.05      // Very rare (5%)
                    };
                    
                    const chance = adnDropChance[farm.plantType] || 0.2;
                    
                    if (Math.random() < chance) {
                        if (!gameState.adn) gameState.adn = { baby: 0, basic: 0, rapid: 0, premium: 0, elite: 0 };
                        
                        gameState.adn[farm.plantType] = (gameState.adn[farm.plantType] || 0) + 1;
                        
                        const plantName = berryTypes[farm.plantType]?.name || 'planta';
                        const isRare = (farm.adnChance || 20) <= 10;
                        
                        if (isRare) {
                            // Special message for rare ADN (Premium / Élite)
                            showToast(`⭐ ¡ADN ASEGURADO! +1 de ${plantName} (muy raro)`, 'success');
                        } else {
                            showToast(`🧬 +1 ADN de ${plantName} encontrado en el raid!`, 'success');
                        }
                    }
                }
                
                updateBalances();
                showToast(`¡Asalto exitoso! +${reward} USDC`, 'success');
                
                // Small chance to get caught even on success
                if (Math.random() < 0.15 && farm.danger !== 'bajo') {
                    const waterLoss = farm.danger === 'alto' ? 12 : 7;
                    gameState.water = Math.max(0, gameState.water - waterLoss);
                    showToast(`Te vieron pero escapaste. Perdiste ${waterLoss} Agua`, 'error');
                }
                
            } else {
                // Failed - consequences
                let waterLoss = 8;
                let cooldownMinutes = 45;
                
                if (farm.danger === 'medio') {
                    waterLoss = 15;
                    cooldownMinutes = 75;
                } else if (farm.danger === 'alto') {
                    waterLoss = 25;
                    cooldownMinutes = 120;
                }
                
                gameState.water = Math.max(0, gameState.water - waterLoss);
                gameState.raidCooldownUntil = Date.now() + (cooldownMinutes * 60 * 1000);
                
                showToast(`¡Te atraparon! Perdiste ${waterLoss} Agua. Cooldown de ${cooldownMinutes} min`, 'error');
            }
            
            saveGame();
            renderAbandonedFarms();
        }

        function updateExploreTab() {
            if (!document.getElementById('content-explore').classList.contains('hidden')) {
                renderAbandonedFarms();
            }
        }

        // ==================== VIP PASS SYSTEM ====================
        function showVIPPass() {
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/80 flex items-center justify-center z-[950] p-4`;
            
            const hasVIP = gameState.hasVIP || false;
            const hasMonthlyVIP = gameState.hasMonthlyVIP || false;
            const hasBasicPass = gameState.hasBasicPass || false;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl max-w-[820px] w-full overflow-hidden shadow-2xl">
                    
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-600 px-6 py-4 flex items-center justify-between text-white">
                        <div>
                            <div class="font-extrabold text-xl">Pases Premium</div>
                            <div class="text-yellow-100 text-xs">Elige el que mejor se adapte a ti</div>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-3xl leading-none hover:text-yellow-200">×</button>
                    </div>

                    <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                        
                        <!-- VIP Permanente -->
                        <div class="border ${hasVIP ? 'border-emerald-400 bg-emerald-50' : 'border-yellow-200'} rounded-2xl p-4 flex flex-col">
                            <div class="flex justify-between items-start mb-2">
                                <div class="font-extrabold">Pase VIP Permanente</div>
                                ${hasVIP ? '<span class="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded">ACTIVO</span>' : ''}
                            </div>
                            <div class="font-black text-3xl mb-1">45 <span class="text-xs font-bold">USDC</span></div>
                            <div class="text-xs text-slate-500 mb-3">Pago único • Para siempre</div>
                            
                            <div class="text-xs flex-1 space-y-1 text-slate-600 mb-3">
                                <div>✓ 15 Videos diarios</div>
                                <div>✓ -40% Cooldown en Raids</div>
                                <div>✓ +30% ADN en raids</div>
                                <div>✓ +8 Agua diaria +50% Racha</div>
                                <div>✓ Badge Dorado + Prioridad</div>
                            </div>
                            
                            ${!hasVIP ? `
                                <button onclick="purchasePass('permanent', this)" class="mt-auto w-full py-2.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-extrabold rounded-xl">Comprar Permanente</button>
                            ` : `<div class="mt-auto text-center text-emerald-600 text-xs font-bold py-2">¡Gracias por apoyar!</div>`}
                        </div>

                        <!-- VIP Mensual -->
                        <div class="border ${hasMonthlyVIP ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'} rounded-2xl p-4 flex flex-col">
                            <div class="flex justify-between items-start mb-2">
                                <div class="font-extrabold">VIP Mensual</div>
                                ${hasMonthlyVIP ? '<span class="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded">ACTIVO</span>' : ''}
                            </div>
                            <div class="font-black text-3xl mb-1">12 <span class="text-xs font-bold">USDC/mes</span></div>
                            <div class="text-xs text-slate-500 mb-3">Mismos beneficios que el Permanente</div>
                            
                            <div class="text-xs flex-1 space-y-1 text-slate-600 mb-3">
                                <div>✓ Todos los beneficios del Permanente</div>
                                <div>✓ Se renueva automáticamente</div>
                            </div>
                            
                            ${!hasMonthlyVIP && !hasVIP ? `
                                <button onclick="purchasePass('monthly', this)" class="mt-auto w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-extrabold rounded-xl">Suscribirse - 12 USDC/mes</button>
                            ` : hasMonthlyVIP ? `<div class="mt-auto text-center text-emerald-600 text-xs font-bold py-2">Suscripción activa</div>` : `<div class="mt-auto text-center text-xs text-slate-400 py-2">Ya tienes el Permanente</div>`}
                        </div>

                        <!-- Pase Básico -->
                        <div class="border ${hasBasicPass ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200'} rounded-2xl p-4 flex flex-col">
                            <div class="flex justify-between items-start mb-2">
                                <div class="font-extrabold">Pase Básico Mensual</div>
                                ${hasBasicPass ? '<span class="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded">ACTIVO</span>' : ''}
                            </div>
                            <div class="font-black text-3xl mb-1">6 <span class="text-xs font-bold">USDC/mes</span></div>
                            <div class="text-xs text-slate-500 mb-3">Ideal para empezar</div>
                            
                            <div class="text-xs flex-1 space-y-1 text-slate-600 mb-3">
                                <div>✓ 12 Videos diarios</div>
                                <div>✓ +4 Agua diaria gratis</div>
                                <div>✓ +20% ADN en raids</div>
                                <div>✓ -20% Cooldown en Raids</div>
                            </div>
                            
                            ${!hasBasicPass && !hasVIP && !hasMonthlyVIP ? `
                                <button onclick="purchasePass('basic', this)" class="mt-auto w-full py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-sm font-extrabold rounded-xl">Suscribirse - 6 USDC/mes</button>
                            ` : hasBasicPass ? `<div class="mt-auto text-center text-emerald-600 text-xs font-bold py-2">Activo</div>` : `<div class="mt-auto text-center text-xs text-slate-400 py-2">Ya tienes un pase superior</div>`}
                        </div>

                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }

        function purchasePass(type, btn) {
            let cost = 0;
            let message = "";
            
            if (type === 'permanent') {
                cost = 45;
                message = "¡Pase VIP Permanente activado! Disfruta todos los beneficios de por vida.";
                gameState.hasVIP = true;
            } 
            else if (type === 'monthly') {
                cost = 12;
                message = "¡Suscripción VIP Mensual activada! Se renovará automáticamente.";
                gameState.hasMonthlyVIP = true;
            } 
            else if (type === 'basic') {
                cost = 6;
                message = "¡Pase Básico Mensual activado!";
                gameState.hasBasicPass = true;
            }
            
            if (gameState.usdc < cost) {
                alert("No tienes suficiente USDC.");
                return;
            }
            
            gameState.usdc -= cost;
            saveGame();
            updateBalances();
            
            btn.closest('.fixed').remove();
            showToast(message, 'success');
        }

        function purchaseVIPPass(btn) {
            if (gameState.usdc < 45) {
                alert("No tienes suficiente USDC para comprar el Pase VIP.");
                return;
            }
            
            gameState.usdc -= 45;
            gameState.hasVIP = true;
            
            saveGame();
            updateBalances();
            
            // Close modal
            btn.closest('.fixed').remove();
            
            showToast("¡Felicidades! Ahora tienes el Pase VIP activo. Disfruta tus beneficios.", 'success');
            
            // Optional: refresh some UI
            setTimeout(() => {
                if (typeof renderPlots === 'function') renderPlots();
            }, 500);
        }

        // ==================== LABORATORY + ADN SYSTEM ====================
        function showLaboratory() {
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/70 flex items-center justify-center z-[900] p-4`;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl max-w-[620px] w-full p-7 shadow-2xl max-h-[92vh] overflow-auto">
                    <div class="flex justify-between items-center mb-6">
                        <div>
                            <div class="font-extrabold text-2xl flex items-center gap-x-2">
                                <i class="fa-solid fa-flask text-purple-600"></i>
                                <span>Laboratorio de Plantas</span>
                            </div>
                            <div class="text-sm text-purple-600">Fusiona ADN recolectado en raids para crear plantas mejoradas</div>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-3xl leading-none text-slate-400 hover:text-slate-600">×</button>
                    </div>

                    <!-- ADN Collection -->
                    <div class="mb-6">
                        <div class="font-extrabold text-lg mb-3 flex items-center gap-x-2">
                            <span>Tu Colección de ADN</span>
                            <span class="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Se obtiene en raids</span>
                        </div>
                        
                        <div class="grid grid-cols-5 gap-2" id="adn-collection">
                            <!-- Populated by JS -->
                        </div>
                    </div>

                    <!-- Active Fusions -->
                    <div class="mb-6" id="active-fusions-section">
                        <div class="font-extrabold text-lg mb-3">Fusiones en Progreso</div>
                        <div id="active-fusions-list" class="space-y-2">
                            <!-- Populated by JS -->
                        </div>
                    </div>

                    <!-- Available Fusions -->
                    <div>
                        <div class="font-extrabold text-lg mb-3">Plantas Mejoradas Disponibles</div>
                        <div id="available-fusions" class="space-y-3">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Render everything
            renderADNCollection(modal);
            renderActiveFusions(modal);
            renderAvailableFusions(modal);
            
            // Auto refresh every 10 seconds for countdowns
            const interval = setInterval(() => {
                if (!document.body.contains(modal)) {
                    clearInterval(interval);
                    return;
                }
                renderActiveFusions(modal);
            }, 10000);
        }

        function renderADNCollection(modal) {
            const container = modal.querySelector('#adn-collection');
            if (!container) return;
            
            const adn = gameState.adn || { baby: 0, basic: 0, rapid: 0, premium: 0, elite: 0 };
            const types = [
                { key: 'baby', name: 'Bebé', color: 'pink' },
                { key: 'basic', name: 'Básica', color: 'emerald' },
                { key: 'rapid', name: 'Rápida', color: 'sky' },
                { key: 'premium', name: 'Premium', color: 'violet' },
                { key: 'elite', name: 'Élite', color: 'amber' }
            ];
            
            container.innerHTML = types.map(t => {
                const count = adn[t.key] || 0;
                return `
                    <div class="bg-white border border-${t.color}-200 rounded-2xl p-3 text-center">
                        <div class="text-2xl mb-1">${berryTypes[t.key]?.emoji || '🧬'}</div>
                        <div class="font-extrabold text-sm">${t.name}</div>
                        <div class="font-black text-2xl text-${t.color}-600">${count}</div>
                        <div class="text-[10px] text-slate-500">/ 10</div>
                    </div>
                `;
            }).join('');
        }

        function renderActiveFusions(modal) {
            const container = modal.querySelector('#active-fusions-list');
            if (!container) return;
            
            const fusions = gameState.activeFusions || [];
            
            if (fusions.length === 0) {
                container.innerHTML = `<div class="text-sm text-slate-500 italic">No tienes fusiones en progreso.</div>`;
                return;
            }
            
            container.innerHTML = fusions.map((fusion, index) => {
                const now = Date.now();
                const remaining = Math.max(0, fusion.readyAt - now);
                const hoursLeft = Math.floor(remaining / (1000 * 60 * 60));
                const minsLeft = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                
                const isReady = remaining <= 0;
                const plant = berryTypes[fusion.plantType];
                
                return `
                    <div class="flex items-center justify-between bg-purple-50 border border-purple-200 rounded-2xl px-4 py-3">
                        <div>
                            <div class="font-extrabold">${plant?.name || 'Planta'} Mejorada</div>
                            <div class="text-xs text-purple-600">${isReady ? '¡Lista para reclamar!' : `Termina en ${hoursLeft}h ${minsLeft}m`}</div>
                        </div>
                        <div>
                            ${isReady 
                                ? `<button onclick="claimFusion(${index}, this)" class="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-extrabold rounded-2xl">Reclamar</button>`
                                : `<div class="px-4 py-2 text-xs text-purple-600 font-bold">En proceso...</div>`
                            }
                        </div>
                    </div>
                `;
            }).join('');
        }

        function renderAvailableFusions(modal) {
            const container = modal.querySelector('#available-fusions');
            if (!container) return;
            
            const adn = gameState.adn || {};
            const types = ['baby', 'basic', 'rapid', 'premium', 'elite'];
            
            let html = '';
            
            types.forEach(type => {
                const count = adn[type] || 0;
                const plant = berryTypes[type];
                if (!plant) return;
                
                const canFuse = count >= 10;
                
                html += `
                    <div class="flex items-center justify-between bg-white border ${canFuse ? 'border-purple-300' : 'border-slate-200'} rounded-2xl px-4 py-3">
                        <div class="flex items-center gap-x-3">
                            <span class="text-3xl">${plant.emoji}</span>
                            <div>
                                <div class="font-extrabold">${plant.name} <span class="text-purple-600">Mejorada</span></div>
                                <div class="text-xs text-slate-500">Requiere 10 ADN • +15% producción • -20% agua</div>
                            </div>
                        </div>
                        
                        <div class="text-right">
                            <div class="text-sm font-bold mb-1">${count}/10 ADN</div>
                            ${canFuse 
                                ? `<button onclick="startFusion('${type}', this)" class="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-extrabold rounded-2xl">Iniciar Fusión (24h)</button>`
                                : `<div class="text-xs text-slate-400">Necesitas ${10 - count} más</div>`
                            }
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }

        function startFusion(plantType, btn) {
            if (!gameState.adn || gameState.adn[plantType] < 10) {
                alert("No tienes suficiente ADN");
                return;
            }
            
            // Consume 10 ADN
            gameState.adn[plantType] -= 10;
            
            // Create fusion (24 hours)
            const now = Date.now();
            const readyAt = now + (24 * 60 * 60 * 1000); // 24 hours
            
            if (!gameState.activeFusions) gameState.activeFusions = [];
            
            gameState.activeFusions.push({
                plantType: plantType,
                startTime: now,
                readyAt: readyAt
            });
            
            saveGame();
            
            // Refresh modal
            const modal = btn.closest('.fixed');
            if (modal) {
                renderADNCollection(modal);
                renderActiveFusions(modal);
                renderAvailableFusions(modal);
            }
            
            showToast(`¡Fusión iniciada! La planta estará lista en 24 horas.`, 'success');
        }

        function claimFusion(index, btn) {
            const fusion = gameState.activeFusions[index];
            if (!fusion) return;
            
            const now = Date.now();
            if (now < fusion.readyAt) {
                alert("Aún no está lista");
                return;
            }
            
            const plantType = fusion.plantType;
            const plant = berryTypes[plantType];
            
            // Find empty plot
            let emptyPlotIndex = -1;
            for (let i = 0; i < gameState.unlockedPlots; i++) {
                if (!gameState.plots[i] || !gameState.plots[i].type) {
                    emptyPlotIndex = i;
                    break;
                }
            }
            
            if (emptyPlotIndex === -1) {
                alert("No tienes parcelas vacías. Libera una primero.");
                return;
            }
            
            // Create improved plant (we'll mark it with _improved flag)
            const improvedType = plantType + '_improved';
            
            // For now we use the same base but mark it as improved
            // In a full version we would have separate entries in berryTypes
            gameState.plots[emptyPlotIndex] = {
                type: plantType,           // base type
                isImproved: true,          // flag for better stats
                plantedAt: Date.now(),
                lastWatered: Date.now(),
                lastHarvest: null,
                hasPest: false
            };
            
            // Remove the fusion
            gameState.activeFusions.splice(index, 1);
            
            saveGame();
            renderPlots();
            
            // Close modal and show success
            btn.closest('.fixed').remove();
            
            showToast(`¡${plant.name} Mejorada plantada! +15% producción y -20% agua`, 'success');
        }

        // ==================== EARNINGS CALCULATOR ====================
        function showEarningsCalculator() {
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/70 flex items-center justify-center z-[900] p-4`;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl max-w-[520px] w-full p-7 shadow-2xl">
                    <div class="flex justify-between items-center mb-5">
                        <div>
                            <div class="font-extrabold text-2xl">Calculadora Mixta</div>
                            <div class="text-sm text-emerald-600">Mezcla diferentes plantas y calcula ganancias reales</div>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-3xl leading-none text-slate-400 hover:text-slate-600">×</button>
                    </div>

                    <!-- Add Plant Row -->
                    <div class="flex gap-2 mb-4">
                        <select id="calc-plant-select" class="flex-1 border border-emerald-200 rounded-2xl px-3 py-2 text-sm font-bold">
                            <option value="baby">Frutilla Bebé ($5)</option>
                            <option value="basic">Frutilla Básica ($18)</option>
                            <option value="rapid">Frutilla Rápida ($15)</option>
                            <option value="premium">Frutilla Premium ($68)</option>
                            <option value="elite">Frutilla Élite ($125)</option>
                        </select>
                        <input type="number" id="calc-qty-input" value="1" min="1" class="w-20 border border-emerald-200 rounded-2xl px-3 py-2 text-center font-bold">
                        <button onclick="addPlantToCalculator()" class="px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm">Agregar</button>
                    </div>

                    <!-- List of added plants -->
                    <div id="calc-plants-list" class="min-h-[90px] bg-emerald-50 border border-emerald-100 rounded-2xl p-3 mb-4 text-sm space-y-1">
                        <!-- Dynamic rows added here -->
                    </div>

                    <div class="flex gap-2 mb-5">
                        <button onclick="clearCalculatorPlants()" class="flex-1 py-2 text-xs font-bold border border-emerald-300 rounded-2xl hover:bg-white">Limpiar todo</button>
                        <button onclick="calculateMixedEarnings()" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl text-sm">Calcular Todo</button>
                    </div>

                    <!-- Results -->
                    <div id="calc-mixed-results" class="hidden bg-emerald-950 text-white rounded-2xl p-5 text-sm space-y-2">
                        <div class="flex justify-between"><span class="text-emerald-400">Ganancia bruta/día</span> <span id="mixed-daily" class="font-extrabold"></span></div>
                        <div class="flex justify-between text-red-400"><span>Costo agua/día</span> <span id="mixed-water"></span></div>
                        <div class="flex justify-between font-bold border-t border-emerald-800 pt-2"><span class="text-emerald-300">Ganancia NETA/día</span> <span id="mixed-net" class="text-emerald-400"></span></div>
                        <div class="flex justify-between pt-1"><span class="text-emerald-400">Retiro 15 días (neto)</span> <span id="mixed-withdraw" class="font-extrabold"></span></div>
                        <div class="flex justify-between border-t border-emerald-800 pt-2"><span class="text-emerald-400">Inversión total</span> <span id="mixed-investment" class="font-extrabold"></span></div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Store plants in modal dataset
            modal.dataset.plants = JSON.stringify([]);
        }

        let currentCareLevel = 1.0;

        function setCareLevel(btn, level) {
            // Remove active from all
            document.querySelectorAll('.care-btn').forEach(b => {
                b.classList.remove('active', 'bg-emerald-600', 'text-white', 'border-emerald-600');
                b.classList.add('border-emerald-200');
            });
            
            btn.classList.add('active', 'bg-emerald-600', 'text-white', 'border-emerald-600');
            currentCareLevel = level;
        }

        // ==================== MIXED PLANTS CALCULATOR HELPERS ====================
        function addPlantToCalculator() {
            const modal = document.querySelector('.fixed.z-\\[900\\]');
            if (!modal) return;

            const plantType = document.getElementById('calc-plant-select').value;
            const qty = parseInt(document.getElementById('calc-qty-input').value) || 1;
            const plant = berryTypes[plantType];

            let plants = JSON.parse(modal.dataset.plants || '[]');
            
            // Add or update quantity if same type already exists
            const existing = plants.findIndex(p => p.type === plantType);
            if (existing !== -1) {
                plants[existing].qty += qty;
            } else {
                plants.push({
                    type: plantType,
                    name: plant.name,
                    price: plant.price,
                    qty: qty
                });
            }

            modal.dataset.plants = JSON.stringify(plants);
            renderCalculatorPlantsList(modal);
        }

        function renderCalculatorPlantsList(modal) {
            const list = document.getElementById('calc-plants-list');
            if (!list) return;

            let plants = JSON.parse(modal.dataset.plants || '[]');
            
            if (plants.length === 0) {
                list.innerHTML = `<div class="text-center text-emerald-500 text-xs py-4">Agrega plantas arriba para calcular</div>`;
                return;
            }

            list.innerHTML = plants.map((p, index) => `
                <div class="flex justify-between items-center bg-white rounded-xl px-3 py-1.5 text-sm">
                    <div><span class="font-bold">${p.name}</span> <span class="text-emerald-600">x${p.qty}</span></div>
                    <div class="flex items-center gap-x-3">
                        <span class="font-mono text-emerald-700">$${(p.price * p.qty).toFixed(0)}</span>
                        <button onclick="removePlantFromCalculator(${index}, this)" class="text-red-400 hover:text-red-600 px-1">×</button>
                    </div>
                </div>
            `).join('');
        }

        function removePlantFromCalculator(index, btn) {
            const modal = btn.closest('.fixed');
            let plants = JSON.parse(modal.dataset.plants || '[]');
            plants.splice(index, 1);
            modal.dataset.plants = JSON.stringify(plants);
            renderCalculatorPlantsList(modal);
        }

        function clearCalculatorPlants() {
            const modal = document.querySelector('.fixed.z-\\[900\\]');
            if (!modal) return;
            modal.dataset.plants = JSON.stringify([]);
            document.getElementById('calc-plants-list').innerHTML = `<div class="text-center text-emerald-500 text-xs py-4">Agrega plantas arriba para calcular</div>`;
            document.getElementById('calc-mixed-results').classList.add('hidden');
        }

        function calculateMixedEarnings() {
            const modal = document.querySelector('.fixed.z-\\[900\\]');
            if (!modal) return;

            let plants = JSON.parse(modal.dataset.plants || '[]');
            if (plants.length === 0) {
                alert("Agrega al menos una planta");
                return;
            }

            let totalDailyGross = 0;
            let totalInvestment = 0;
            let totalWaterUnits = 0;

            plants.forEach(p => {
                const plantData = berryTypes[p.type];
                if (!plantData) return;

                const dailyPerPlant = (plantData.harvestReward / (plantData.harvestCooldown / (1000 * 60 * 60 * 24)));
                totalDailyGross += dailyPerPlant * p.qty;
                totalInvestment += plantData.price * p.qty;
                totalWaterUnits += 1.8 * p.qty; // ~1.8 water units per plant per day
            });

            const waterCostPerDay = totalWaterUnits * 0.09; // 0.09 USDC per water unit
            const netDaily = totalDailyGross - waterCostPerDay;
            const withdraw15 = netDaily * 15;

            // Show results
            const results = document.getElementById('calc-mixed-results');
            results.classList.remove('hidden');

            document.getElementById('mixed-daily').textContent = totalDailyGross.toFixed(2) + ' USDC';
            document.getElementById('mixed-water').textContent = '-' + waterCostPerDay.toFixed(2) + ' USDC';
            document.getElementById('mixed-net').textContent = netDaily.toFixed(2) + ' USDC';
            document.getElementById('mixed-withdraw').textContent = withdraw15.toFixed(2) + ' USDC';
            document.getElementById('mixed-investment').textContent = '$' + totalInvestment.toFixed(0) + ' USDC';
        }

        // ==================== FAKE ACTIVITY FEED ====================
        const activityMessages = [
            "compró 2 parcelas de tierra",
            "solicitó retiro de",
            "compró Espantapájaros permanente",
            "plantó 3 Frutillas Premium",
            "compró Pack de Agua",
            "compró Frutilla Élite",
            "solicitó pago de",
            "compró 5 Frutillas Bebé",
            "activó Espantapájaros en su granja",
            "compró Regadera Mejorada"
        ];

        function generateFakeWallet() {
            const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
            let wallet = '0x';
            for (let i = 0; i < 6; i++) {
                wallet += chars[Math.floor(Math.random() * chars.length)];
            }
            wallet += '...';
            for (let i = 0; i < 4; i++) {
                wallet += chars[Math.floor(Math.random() * chars.length)];
            }
            return wallet;
        }

        function addFakeActivity() {
            const feed = document.getElementById('activity-list');
            if (!feed) return;

            const wallet = generateFakeWallet();
            const action = activityMessages[Math.floor(Math.random() * activityMessages.length)];
            
            let amount = '';
            if (action.includes('retiro') || action.includes('pago')) {
                amount = ` ${ (Math.random() * 80 + 20).toFixed(0) } USDC`;
            } else if (action.includes('parcelas')) {
                amount = ` x${Math.floor(Math.random() * 2) + 1}`;
            }

            // Show only ONE activity at a time (cleaner)
            feed.innerHTML = `
                <div class="flex items-center gap-x-2 whitespace-nowrap text-emerald-100 animate-[fadeIn_0.5s_ease]">
                    <span class="font-mono text-[10px] bg-emerald-800 px-2 py-0.5 rounded font-bold">${wallet}</span>
                    <span class="text-emerald-200">${action}${amount}</span>
                </div>
            `;
        }

        function startFakeActivity() {
            const feedContainer = document.getElementById('activity-feed');
            if (feedContainer) feedContainer.classList.remove('hidden');

            // Add first activity quickly
            setTimeout(() => {
                addFakeActivity();
            }, 2500);

            // Change activity every 7-10 seconds (one at a time)
            setInterval(() => {
                addFakeActivity();
            }, 7000 + Math.random() * 3000);
        }

        function updateFarmStats() {
            // Update active plants count
            const activePlantsEl = document.getElementById('stat-active-plants');
            if (activePlantsEl) {
                const active = gameState.plots.filter(p => p.type).length;
                activePlantsEl.textContent = active;
            }
            
            // Update plots count
            const plotsEl = document.getElementById('stat-plots');
            if (plotsEl) {
                plotsEl.textContent = `${gameState.unlockedPlots}/12`;
            }
            
            // Update Scarecrow status
            const scarecrowEl = document.getElementById('stat-scarecrow');
            if (scarecrowEl) {
                if (gameState.upgrades && gameState.upgrades.hasScarecrow) {
                    scarecrowEl.innerHTML = `
                        <div class="inline-flex items-center gap-x-2 px-4 py-1 bg-amber-50 border border-amber-200 rounded-3xl text-sm">
                            <span>🧍‍♂️</span>
                            <span class="font-extrabold text-amber-700">Espantapájaros Permanente</span>
                            <span class="text-xs text-amber-500">(Todas protegidas)</span>
                        </div>
                    `;
                } else {
                    scarecrowEl.innerHTML = `<span class="text-xs text-amber-600">Sin Espantapájaros • Disponible en Tienda</span>`;
                }
            }
        }

        // ==================== WELCOME CHEST ====================
        function showWelcomeChest() {
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/70 flex items-center justify-center z-[700] p-4`;
            
            modal.innerHTML = `
                <div class="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl">
                    <div class="text-7xl mb-4">🎁</div>
                    <div class="font-extrabold text-3xl mb-2">¡Cofre de Bienvenida!</div>
                    <div class="text-emerald-600 mb-6">Para jugadores nuevos</div>
                    
                    <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-6">
                        <div class="text-5xl mb-3">🍓</div>
                        <div class="font-extrabold text-xl">Frutilla Bebé</div>
                        <div class="text-sm text-emerald-600 mt-1">1 planta permanente</div>
                        <div class="text-xs text-emerald-500 mt-2">+ 12 de Agua</div>
                    </div>
                    
                    <button onclick="claimWelcomeChest(this)" 
                            class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-lg rounded-3xl active:scale-[0.985]">
                        Reclamar Cofre
                    </button>
                    
                    <div class="text-xs text-slate-400 mt-4">Solo disponible una vez</div>
                </div>
            `;
            
            document.body.appendChild(modal);
        }
        
        function claimWelcomeChest(btn) {
            const modal = btn.closest('.fixed');
            
            // Plant Frutilla Bebé in first empty plot (with expiration flag)
            let planted = false;
            for (let i = 0; i < gameState.unlockedPlots; i++) {
                if (!gameState.plots[i].type) {
                    gameState.plots[i].type = 'baby';
                    gameState.plots[i].plantedAt = Date.now();
                    gameState.plots[i].lastWatered = Date.now();
                    gameState.plots[i].lastHarvest = Date.now();
                    gameState.plots[i].hasPest = false;
                    gameState.plots[i].isWelcomePlant = true; // This one will expire after 12 days
                    planted = true;
                    break;
                }
            }
            
            // Give starting water
            gameState.water = (gameState.water || 0) + 12;
            
            gameState.hasReceivedWelcomeBonus = true;
            saveGame();
            
            modal.remove();
            
            updateBalances();
            renderPlots();
            
            if (planted) {
                showToast("¡Cofre reclamado! Frutilla Bebé plantada + 12 de Agua (dura 12 días)", 'success');
            } else {
                showToast("¡Cofre reclamado! +12 de Agua", 'success');
            }
        }

        // ==================== RAID LOOT SYSTEM ====================
        function giveRaidLoot(farm) {
            if (!farm.possibleLoot || farm.possibleLoot.length === 0) {
                // Fallback: give small amount of water
                gameState.water += 3;
                showToast("¡Encontraste un poco de agua!", 'success');
                return;
            }
            
            // Weighted random selection
            const totalChance = farm.possibleLoot.reduce((sum, item) => sum + item.chance, 0);
            let random = Math.random() * totalChance;
            
            let selectedItem = farm.possibleLoot[0];
            
            for (let item of farm.possibleLoot) {
                if (random < item.chance) {
                    selectedItem = item;
                    break;
                }
                random -= item.chance;
            }
            
            // Give the item
            let message = "";
            
            switch (selectedItem.type) {
                case 'water':
                    gameState.water += selectedItem.amount;
                    message = `¡Encontraste ${selectedItem.amount} de Agua!`;
                    break;
                    
                case 'insumo':
                    gameState.insumos = (gameState.insumos || 0) + selectedItem.amount;
                    message = `¡Encontraste ${selectedItem.amount} Insumos Antiplagas!`;
                    break;
                    
                case 'dogBone':
                    gameState.raidTools.dogBone = (gameState.raidTools.dogBone || 0) + selectedItem.amount;
                    message = `¡Encontraste un Hueso para Perro!`;
                    break;
                    
                case 'stealthKit':
                    gameState.raidTools.stealthKit = (gameState.raidTools.stealthKit || 0) + selectedItem.amount;
                    message = `¡Encontraste un Kit de Sigilo!`;
                    break;
                    
                case 'extraPlot':
                    // Give extra plot (max 12 plots)
                    if (gameState.unlockedPlots < 12) {
                        gameState.unlockedPlots++;
                        // Add new empty plot
                        gameState.plots.push({
                            type: null, plantedAt: null, lastWatered: null, 
                            lastHarvest: null, hasPest: false
                        });
                        message = `¡Encontraste Tierra! +1 Parcela extra`;
                    } else {
                        // If already max plots, give good loot instead
                        gameState.raidTools.stealthKit = (gameState.raidTools.stealthKit || 0) + 1;
                        message = `¡Encontraste un Kit de Sigilo! (ya tienes máximo de parcelas)`;
                    }
                    break;
                    
                default:
                    gameState.water += 4;
                    message = "¡Encontraste algunos recursos!";
            }
            
            showToast(message, 'success');
        }

        // ==================== RAID ANIMATION MODAL (Interactive Clicker) ====================
        function showRaidAnimationModal(farm) {
            const modal = document.createElement('div');
            modal.className = `fixed inset-0 bg-black/95 flex items-center justify-center z-[600] p-4`;
            
            const hasDogBone = gameState.raidTools.dogBone > 0;
            const hasStealthKit = gameState.raidTools.stealthKit > 0;
            
            let toolsText = '';
            if (hasDogBone && farm.danger === 'alto') toolsText = '🦴 Hueso activado (+28%)';
            if (hasStealthKit) toolsText = (toolsText ? toolsText + ' • ' : '') + '🥷 Sigilo activado (+22%)';
            
            modal.innerHTML = `
                <div class="bg-[#1a120b] border-2 border-orange-800 rounded-3xl w-full max-w-md overflow-hidden">
                    
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-orange-950 to-black px-5 py-3.5 flex justify-between items-center">
                        <div>
                            <div class="font-extrabold text-orange-300">Asaltando plantación</div>
                            <div class="text-xs text-orange-500">${farm.name}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-orange-400">Peligro ${farm.danger.toUpperCase()}</div>
                            <div id="raid-timer" class="font-mono text-2xl font-black text-orange-400">08</div>
                        </div>
                    </div>
                    
                    <!-- Clicker Area -->
                    <div class="relative bg-[#2c2118] h-[280px] flex flex-wrap items-center justify-center gap-4 p-6" id="raid-click-area">
                        <!-- Strawberries added by JS -->
                    </div>
                    
                    <!-- Info -->
                    <div class="px-5 py-4 bg-black/40 text-center">
                        <div class="text-sm text-orange-300 font-medium mb-1">
                            ¡Haz clic rápido en las frutillas!
                        </div>
                        <div id="raid-click-count" class="text-xs text-orange-400">
                            Robadas: <span class="font-black text-lg text-orange-300">0</span> / 8
                        </div>
                        
                        ${toolsText ? `
                            <div class="mt-2 text-[10px] text-emerald-400">${toolsText}</div>
                        ` : ''}
                    </div>
                    
                    <div class="p-4 bg-black flex gap-x-3">
                        <button onclick="finishRaidEarly(this)" 
                                class="flex-1 py-3 text-sm font-extrabold border border-orange-700 text-orange-400 rounded-3xl hover:bg-orange-950">
                            Terminar ahora
                        </button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            setupRaidClicker(modal, farm, hasDogBone, hasStealthKit);
        }
        
        function setupRaidClicker(modal, farm, hasDogBone, hasStealthKit) {
            const clickArea = modal.querySelector('#raid-click-area');
            const countEl = modal.querySelector('#raid-click-count');
            const timerEl = modal.querySelector('#raid-timer');
            
            let clicks = 0;
            const maxFruits = 8;
            let timeLeft = 8;
            let gameEnded = false;
            
            // Create clickable strawberries
            for (let i = 0; i < maxFruits; i++) {
                const fruit = document.createElement('div');
                fruit.className = `text-6xl cursor-pointer transition-all active:scale-75 select-none`;
                fruit.innerHTML = '🍓';
                fruit.style.transition = 'transform 0.1s ease, opacity 0.3s ease';
                
                fruit.onclick = () => {
                    if (gameEnded || fruit.classList.contains('collected')) return;
                    
                    fruit.classList.add('collected');
                    fruit.style.transform = 'scale(0.3)';
                    fruit.style.opacity = '0.15';
                    
                    clicks++;
                    countEl.innerHTML = `Robadas: <span class="font-black text-lg text-orange-300">${clicks}</span> / ${maxFruits}`;
                    
                    // Floating text
                    const floatText = document.createElement('div');
                    floatText.className = 'absolute text-emerald-400 font-black text-xl pointer-events-none';
                    floatText.style.left = `${fruit.offsetLeft + 18}px`;
                    floatText.style.top = `${fruit.offsetTop + 5}px`;
                    floatText.innerHTML = '+1';
                    clickArea.appendChild(floatText);
                    
                    setTimeout(() => {
                        floatText.style.transition = 'all 0.5s ease';
                        floatText.style.transform = 'translateY(-35px)';
                        floatText.style.opacity = '0';
                        setTimeout(() => floatText.remove(), 500);
                    }, 20);
                };
                
                clickArea.appendChild(fruit);
            }
            
            // Countdown timer
            const timerInterval = setInterval(() => {
                timeLeft--;
                timerEl.textContent = timeLeft < 10 ? `0${timeLeft}` : timeLeft;
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    endRaidGame(modal, farm, clicks, maxFruits, hasDogBone, hasStealthKit);
                }
            }, 1000);
            
            modal.raidTimerInterval = timerInterval;
            modal.raidClicks = clicks;
            modal.raidMax = maxFruits;
        }
        
        function finishRaidEarly(btn) {
            const modal = btn.closest('.fixed');
            if (modal.raidTimerInterval) clearInterval(modal.raidTimerInterval);
            modal.remove();
            showToast("Asalto cancelado", 'success');
        }
        
        function endRaidGame(modal, farm, clicks, maxFruits, hasDogBone, hasStealthKit) {
            if (modal.raidTimerInterval) clearInterval(modal.raidTimerInterval);
            
            const clickArea = modal.querySelector('#raid-click-area');
            clickArea.innerHTML = `
                <div class="text-center w-full">
                    <div class="text-6xl mb-3">🏃‍♂️</div>
                    <div class="font-extrabold text-xl text-orange-300">Escapando...</div>
                </div>
            `;
            
            setTimeout(() => {
                modal.remove();
                
                // Calculate success
                let successRate = (clicks / maxFruits) * 0.65;
                
                if (farm.danger === 'bajo') successRate += 0.28;
                else if (farm.danger === 'medio') successRate += 0.18;
                else successRate += 0.08;
                
                if (hasStealthKit) successRate += 0.15;
                if (hasDogBone && farm.danger === 'alto') successRate += 0.18;
                
                successRate = Math.min(0.93, successRate);
                const success = Math.random() < successRate;
                
                if (success) {
                    // Give random loot instead of direct USDC
                    giveRaidLoot(farm);
                    farm.plantsLeft = Math.max(0, farm.plantsLeft - 1);
                    
                    updateBalances();
                    saveGame();
                    
                    const winModal = document.createElement('div');
                    winModal.className = `fixed inset-0 bg-black/90 flex items-center justify-center z-[600]`;
                    winModal.innerHTML = `
                        <div class="bg-emerald-950 border border-emerald-700 rounded-3xl p-8 max-w-sm mx-4 text-center">
                            <div class="text-6xl mb-3">✅</div>
                            <div class="font-extrabold text-2xl text-emerald-400">¡Buen trabajo!</div>
                            <div class="text-5xl font-black text-emerald-300 my-4">+${total} USDC</div>
                            <div class="text-sm text-emerald-400 mb-6">Robaste ${clicks}/${maxFruits} frutillas</div>
                            
                            <button onclick="this.closest('.fixed').remove(); renderAbandonedFarms()" 
                                    class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 rounded-3xl font-extrabold text-white">
                                Continuar
                            </button>
                        </div>
                    `;
                    document.body.appendChild(winModal);
                    
                } else {
                    let waterLoss = farm.danger === 'alto' ? 24 : farm.danger === 'medio' ? 15 : 9;
                    let cd = farm.danger === 'alto' ? 115 : farm.danger === 'medio' ? 75 : 45;
                    
                    gameState.water = Math.max(0, gameState.water - waterLoss);
                    gameState.raidCooldownUntil = Date.now() + (cd * 60 * 1000);
                    saveGame();
                    
                    const loseModal = document.createElement('div');
                    loseModal.className = `fixed inset-0 bg-black/90 flex items-center justify-center z-[600]`;
                    loseModal.innerHTML = `
                        <div class="bg-red-950 border border-red-700 rounded-3xl p-8 max-w-sm mx-4 text-center">
                            <div class="text-6xl mb-3">🚨</div>
                            <div class="font-extrabold text-2xl text-red-400">¡Te atraparon!</div>
                            <div class="text-xl text-red-300 my-2">Perdiste <span class="font-black">${waterLoss} Agua</span></div>
                            <div class="text-sm text-red-400 mb-6">Cooldown: ${cd} minutos</div>
                            
                            <button onclick="this.closest('.fixed').remove(); renderAbandonedFarms()" 
                                    class="w-full py-3.5 bg-red-600 hover:bg-red-700 rounded-3xl font-extrabold text-white">
                                Entendido
                            </button>
                        </div>
                    `;
                    document.body.appendChild(loseModal);
                }
                
                renderAbandonedFarms();
            }, 850);
        }

        function executeRaidResult(farm, usedDogBone, usedStealthKit) {
            // Apply tool effects
            let finalChance = farm.successChance;
            
            if (usedStealthKit) {
                finalChance += 0.22;
                gameState.raidTools.stealthKit = Math.max(0, gameState.raidTools.stealthKit - 1);
            }
            if (usedDogBone && farm.danger === 'alto') {
                finalChance += 0.28;
                gameState.raidTools.dogBone = Math.max(0, gameState.raidTools.dogBone - 1);
            }
            
            finalChance = Math.min(0.95, finalChance);
            const success = Math.random() < finalChance;
            
            if (success) {
                const reward = farm.potentialReward;
                gameState.usdc += reward;
                
                farm.plantsLeft = Math.max(0, farm.plantsLeft - 1);
                if (farm.plantsLeft <= 0) {
                    farm.potentialReward = Math.floor(farm.potentialReward * 0.6);
                }
                
                updateBalances();
                saveGame();
                
                // Success modal
                const successModal = document.createElement('div');
                successModal.className = `fixed inset-0 bg-black/80 flex items-center justify-center z-[600]`;
                successModal.innerHTML = `
                    <div class="bg-emerald-950 border border-emerald-700 rounded-3xl p-8 max-w-sm mx-4 text-center">
                        <div class="text-7xl mb-4">✅</div>
                        <div class="font-extrabold text-3xl text-emerald-400 mb-2">¡Asalto exitoso!</div>
                        <div class="text-4xl font-black text-emerald-300 mb-6">+${reward} USDC</div>
                        
                        <button onclick="this.closest('.fixed').remove(); renderAbandonedFarms()" 
                                class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-3xl">
                            Continuar
                        </button>
                    </div>
                `;
                document.body.appendChild(successModal);
                
                // Small chance to get spotted even on success
                if (Math.random() < 0.12 && farm.danger !== 'bajo') {
                    setTimeout(() => {
                        const waterLoss = farm.danger === 'alto' ? 12 : 7;
                        gameState.water = Math.max(0, gameState.water - waterLoss);
                        saveGame();
                        showToast(`Te vieron pero lograste escapar. Perdiste ${waterLoss} Agua`, 'error');
                    }, 1800);
                }
                
            } else {
                // Failed
                let waterLoss = 8;
                let cooldownMinutes = 45;
                
                if (farm.danger === 'medio') {
                    waterLoss = 15;
                    cooldownMinutes = 75;
                } else if (farm.danger === 'alto') {
                    waterLoss = 25;
                    cooldownMinutes = 120;
                }
                
                gameState.water = Math.max(0, gameState.water - waterLoss);
                gameState.raidCooldownUntil = Date.now() + (cooldownMinutes * 60 * 1000);
                
                saveGame();
                
                const failModal = document.createElement('div');
                failModal.className = `fixed inset-0 bg-black/80 flex items-center justify-center z-[600]`;
                failModal.innerHTML = `
                    <div class="bg-red-950 border border-red-700 rounded-3xl p-8 max-w-sm mx-4 text-center">
                        <div class="text-7xl mb-4">🚨</div>
                        <div class="font-extrabold text-3xl text-red-400 mb-2">¡Te atraparon!</div>
                        <div class="text-xl text-red-300 mb-2">Perdiste <span class="font-black">${waterLoss} Agua</span></div>
                        <div class="text-sm text-red-400 mb-6">Cooldown de ${cooldownMinutes} minutos</div>
                        
                        <button onclick="this.closest('.fixed').remove(); renderAbandonedFarms()" 
                                class="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-extrabold rounded-3xl">
                            Entendido
                        </button>
                    </div>
                `;
                document.body.appendChild(failModal);
            }
            
            renderAbandonedFarms();
        }

        // ==================== INIT ====================
        function initGame() {
            loadGame();
            
            checkAndUpdateStreak();
            resetDailyMissionsIfNeeded();
            
            // Initialize abandoned farms if needed
            if (!gameState.abandonedFarms || gameState.abandonedFarms.length === 0) {
                generateAbandonedFarms();
            }
            
            // === WELCOME CHEST FOR NEW PLAYERS (Frutilla Bebé) ===
            if (!gameState.hasReceivedWelcomeBonus) {
                setTimeout(() => {
                    showWelcomeChest();
                }, 1800);
            }
            
            updateBalances();

            // Give testing money
            if (!gameState.usdc || gameState.usdc < 10000) {
                gameState.usdc = 10000;
            }

            // Robust plot initialization
            if (!gameState.plots || !Array.isArray(gameState.plots)) {
                gameState.plots = [];
            }
            while (gameState.plots.length < MAX_PLOTS) {
                gameState.plots.push({
                    type: null,
                    plantedAt: null,
                    lastWatered: null,
                    lastHarvest: null,
                    hasPest: false
                });
            }
            gameState.plots = gameState.plots.slice(0, MAX_PLOTS);

            renderPlots();
            startLiveUpdate();

            // Apply saved language
            setTimeout(() => {
                setLanguage(currentLang);
            }, 300);
            
            // Activate first tab properly with color
            switchTab('farm');
            
            updateStreakDisplay();
            
            // Start fake activity feed (social proof)
            startFakeActivity();
            
            setInterval(saveGame, 30000);
            
            setInterval(() => {
                updateStreakDisplay();
            }, 60000);
            
            // Auto refresh explore tab timer
            setInterval(() => {
                const timerEl = document.getElementById('farms-refresh-timer');
                if (timerEl && !document.getElementById('content-explore').classList.contains('hidden')) {
                    timerEl.textContent = getTimeUntilFarmsRefresh();
                }
            }, 30000);
        }
        
        // ==================== MULTI-LANGUAGE SYSTEM ====================
        const translations = {
            es: {
                tab_farm: "Granja",
                tab_missions: "Misiones",
                tab_videos: "Ver Videos",
                tab_shop: "Tienda",
                tab_referrals: "Referidos",
                tab_withdrawals: "Retiros",
                tab_explore: "Explorar",
                farm_title: "Tu granja de frutillas",
                farm_subtitle: "Las plantas necesitan agua • Régalas o se secan",
                harvest_all: "Cosechar todo",
                buy_vip: "Comprar Pase VIP",
                plants: "Plantas",
                plots: "Parcelas",
                water: "Agua",
                usdc: "USDC",
                language: "Idioma"
            },
            en: {
                tab_farm: "Farm",
                tab_missions: "Missions",
                tab_videos: "Watch Videos",
                tab_shop: "Shop",
                tab_referrals: "Referrals",
                tab_withdrawals: "Withdrawals",
                tab_explore: "Explore",
                farm_title: "Your Strawberry Farm",
                farm_subtitle: "Plants need water • Water them or they dry out",
                harvest_all: "Harvest All",
                buy_vip: "Buy VIP Pass",
                plants: "Plants",
                plots: "Plots",
                water: "Water",
                usdc: "USDC",
                language: "Language"
            },
            zh: {
                tab_farm: "农场",
                tab_missions: "任务",
                tab_videos: "看视频",
                tab_shop: "商店",
                tab_referrals: "推荐",
                tab_withdrawals: "提现",
                tab_explore: "探索",
                farm_title: "你的草莓农场",
                farm_subtitle: "植物需要水 • 浇水否则会干枯",
                harvest_all: "全部收获",
                buy_vip: "购买VIP通行证",
                plants: "植物",
                plots: "地块",
                water: "水",
                usdc: "USDC",
                language: "语言"
            },
            fr: {
                tab_farm: "Ferme",
                tab_missions: "Missions",
                tab_videos: "Regarder Vidéos",
                tab_shop: "Boutique",
                tab_referrals: "Parrainage",
                tab_withdrawals: "Retraits",
                tab_explore: "Explorer",
                farm_title: "Votre Ferme de Fraises",
                farm_subtitle: "Les plantes ont besoin d'eau • Arrosez-les ou elles sèchent",
                harvest_all: "Tout Récolter",
                buy_vip: "Acheter Pass VIP",
                plants: "Plantes",
                plots: "Parcelles",
                water: "Eau",
                usdc: "USDC",
                language: "Langue"
            }
        };

        let currentLang = localStorage.getItem('berryhash_lang') || 'es';

        function setLanguage(lang) {
            currentLang = lang;
            localStorage.setItem('berryhash_lang', lang);
            
            // Update all data-i18n elements
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (translations[lang] && translations[lang][key]) {
                    el.textContent = translations[lang][key];
                }
            });

            // Update navigation tabs
            const tabUpdates = {
                'tab-farm': 'tab_farm',
                'tab-missions': 'tab_missions',
                'tab-rewards': 'tab_videos',
                'tab-shop': 'tab_shop',
                'tab-referrals': 'tab_referrals',
                'tab-withdrawals': 'tab_withdrawals',
                'tab-explore': 'tab_explore'
            };

            Object.keys(tabUpdates).forEach(id => {
                const el = document.getElementById(id);
                const key = tabUpdates[id];
                if (el && translations[lang] && translations[lang][key]) {
                    const icon = el.querySelector('i');
                    const text = translations[lang][key];
                    el.innerHTML = icon ? '' : '';
                    if (icon) el.appendChild(icon);
                    el.insertAdjacentHTML('beforeend', `<span> ${text}</span>`);
                }
            });
        }

        function t(key) {
            return translations[currentLang]?.[key] || translations['es'][key] || key;
        }

        window.onload = initGame;
        window.BerryHash = { gameState, saveGame, resetFarm: () => {
            if (confirm('¿Quieres borrar todo el progreso y empezar de cero?')) {
                localStorage.removeItem('berryhash_save');
                location.reload();
            }
        }};
        
        // Para resetear todo: abre la consola (F12) y escribe: BerryHash.resetFarm()
