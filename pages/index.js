// pages/app.jsx
import { useEffect, useState } from "react";
import { Home, Trophy, DollarSign, Zap, HelpCircle, Star, Gift } from 'lucide-react';

// TESTING MODE - Set to false when ready for Firebase
const TESTING_MODE = false; // Set to true to avoid Firebase errors

// Firebase imports - only import when needed
let firebaseModules = null;

const getFirebaseModules = async () => {
  if (!firebaseModules && !TESTING_MODE) {
    try {
      // Import Firebase modules dynamically
      const [firestoreModule, firebaseModule] = await Promise.all([
        import('firebase/firestore'),
        import('./firebase') // Make sure this file exists
      ]);
      
      firebaseModules = {
        db: firebaseModule.db,
        doc: firestoreModule.doc,
        getDoc: firestoreModule.getDoc,
        setDoc: firestoreModule.setDoc,
        updateDoc: firestoreModule.updateDoc,
        getDocs: firestoreModule.getDocs,
        collection: firestoreModule.collection,
        query: firestoreModule.query,
        orderBy: firestoreModule.orderBy,
        limit: firestoreModule.limit,
        increment: firestoreModule.increment,
        serverTimestamp: firestoreModule.serverTimestamp,
        writeBatch: firestoreModule.writeBatch
      };
    } catch (error) {
      console.error('Failed to load Firebase modules:', error);
      throw error;
    }
  }
  return firebaseModules;
};

// Mock Firebase functions for testing
const mockFirebase = {
  doc: () => ({}),
  getDoc: () => ({ exists: () => false }),
  setDoc: () => Promise.resolve(),
  updateDoc: () => Promise.resolve(),
  getDocs: () => ({ docs: [] }),
  serverTimestamp: () => Date.now()
};

// Achievement definitions
const ACHIEVEMENTS = [
  {
    id: 'first_tap',
    name: 'First Steps',
    description: 'Make your first tap',
    icon: '👆',
    requirement: { type: 'totalTaps', value: 1 },
    reward: { coins: 100 },
    category: 'milestone'
  },
  {
    id: 'hundred_taps',
    name: 'Getting Started',
    description: 'Reach 100 total taps',
    icon: '💪',
    requirement: { type: 'totalTaps', value: 100 },
    reward: { coins: 500 },
    category: 'milestone'
  },
  {
    id: 'thousand_taps',
    name: 'Dedicated Tapper',
    description: 'Reach 1,000 total taps',
    icon: '🔥',
    requirement: { type: 'totalTaps', value: 1000 },
    reward: { coins: 2000 },
    category: 'milestone'
  },
  {
    id: 'ten_thousand_taps',
    name: 'Tap Master',
    description: 'Reach 10,000 total taps',
    icon: '⭐',
    requirement: { type: 'totalTaps', value: 10000 },
    reward: { coins: 10000 },
    category: 'milestone'
  },
  {
    id: 'first_thousand_coins',
    name: 'Coin Collector',
    description: 'Earn your first 1,000 coins',
    icon: '🪙',
    requirement: { type: 'coins', value: 1000 },
    reward: { coins: 1000 },
    category: 'wealth'
  },
  {
    id: 'energy_master',
    name: 'Energy Efficient',
    description: 'Use all energy 5 times',
    icon: '⚡',
    requirement: { type: 'energyDepletions', value: 5 },
    reward: { coins: 3000 },
    category: 'efficiency'
  },
  {
    id: 'referral_starter',
    name: 'Friend Maker',
    description: 'Refer your first friend',
    icon: '👥',
    requirement: { type: 'referrals', value: 1 },
    reward: { coins: 2500 },
    category: 'social'
  }
];

export default function AppPage() {
  const [user, setUser] = useState(null);
  const [coins, setCoins] = useState(0);
  const [totalTaps, setTotalTaps] = useState(0);
  const [energy, setEnergy] = useState(4104);
  const [maxEnergy] = useState(4104);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('home');
  const [isAnimating, setIsAnimating] = useState(false);
  const [userRank, setUserRank] = useState("Beginner");
  const [userLevel, setUserLevel] = useState(1);
  const [lastEnergyRefresh, setLastEnergyRefresh] = useState(Date.now());
  const [achievements, setAchievements] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [showAchievementPopup, setShowAchievementPopup] = useState(null);
  const [referralCode, setReferralCode] = useState('');
  const [energyDepletions, setEnergyDepletions] = useState(0);
  
  // Batch update states for Firebase (when not in testing mode)
  const [pendingUpdates, setPendingUpdates] = useState({ coins: 0, energy: 0 });
  const [updateTimeout, setUpdateTimeout] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let tg = window.Telegram?.WebApp;

    if (!tg) {
      // ✅ Mock Telegram for browser testing
      tg = {
        ready: () => {},
        initDataUnsafe: {
          user: {
            id: 999999,
            first_name: "Test User",
            username: "testuser",
          },
        },
      };
    }

    tg.ready();
    const tgUser = tg.initDataUnsafe?.user;
    if (tgUser) {
      initializeUser(tgUser).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Energy refresh check - every 2 hours
  useEffect(() => {
    const checkEnergyRefresh = () => {
      const now = Date.now();
      const timeSinceLastRefresh = now - lastEnergyRefresh;
      const twoHoursInMs = 2 * 60 * 60 * 1000;
      
      if (timeSinceLastRefresh >= twoHoursInMs) {
        setEnergy(maxEnergy);
        setLastEnergyRefresh(now);
        
        if (!TESTING_MODE && user) {
          refreshEnergy(user.telegramId);
        }
      }
    };

    checkEnergyRefresh();
    const interval = setInterval(checkEnergyRefresh, 60000);
    
    return () => clearInterval(interval);
  }, [lastEnergyRefresh, maxEnergy, user]);

  // Helper Functions
  function generateReferralCode(telegramId, username) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${username ? username.substring(0, 3).toUpperCase() : 'USR'}${result}`;
  }

  function calculateLevel(totalTaps) {
    if (totalTaps < 100) return 1;
    if (totalTaps < 500) return 2;
    if (totalTaps < 1000) return 3;
    if (totalTaps < 2500) return 4;
    if (totalTaps < 5000) return 5;
    if (totalTaps < 10000) return 6;
    if (totalTaps < 25000) return 7;
    if (totalTaps < 50000) return 8;
    if (totalTaps < 100000) return 9;
    return 10;
  }

  function calculateRank(coins) {
    if (coins >= 150000) return "Legendary";
    if (coins >= 100000) return "Ultra Elite";
    if (coins >= 50000) return "Royal Champion";
    if (coins >= 20000) return "Pro";
    if (coins >= 10000) return "Classic";
    if (coins >= 1000) return "Bronze";
    return "Beginner";
  }

  // Initialize or load user
  async function initializeUser(telegramUser, referralCode = null) {
    try {
      if (TESTING_MODE) {
        // Testing mode - use localStorage or default values
        const savedData = localStorage.getItem('tapcoins_user');
        if (savedData) {
          const userData = JSON.parse(savedData);
          setUser(userData);
          setCoins(userData.coins || 0);
          setTotalTaps(userData.totalTaps || 0);
          setEnergy(userData.energy || 4104);
          setUserRank(userData.rank || "Beginner");
          setUserLevel(userData.level || 1);
          setReferralCode(userData.referralCode || generateReferralCode(telegramUser.id, telegramUser.username));
          setAchievements(userData.achievements || []);
          setEnergyDepletions(userData.energyDepletions || 0);
          setLastEnergyRefresh(userData.lastEnergyRefresh || Date.now());
        } else {
          // New user in testing mode
          const newUser = {
            telegramId: telegramUser.id,
            username: telegramUser.username || null,
            firstName: telegramUser.first_name,
            coins: 0,
            totalTaps: 0,
            energy: 4104,
            rank: "Beginner",
            level: 1,
            achievements: [],
            referralCode: generateReferralCode(telegramUser.id, telegramUser.username),
            energyDepletions: 0,
            lastEnergyRefresh: Date.now()
          };
          
          localStorage.setItem('tapcoins_user', JSON.stringify(newUser));
          setUser(newUser);
          setReferralCode(newUser.referralCode);
        }
        
        // Create mock leaderboard for testing
        createMockLeaderboard();
        return;
      }

      // Real Firebase mode (when TESTING_MODE = false)
      const firebase = await getFirebaseModules();
      
      const userId = String(telegramUser.id);
      const userRef = firebase.doc(firebase.db, "users", userId);
      const userDoc = await firebase.getDoc(userRef);
      
      if (!userDoc.exists()) {
        // New user
        const newUser = {
          telegramId: telegramUser.id,
          username: telegramUser.username || null,
          firstName: telegramUser.first_name,
          lastName: telegramUser.last_name || null,
          coins: 0,
          totalTaps: 0,
          energy: 4104,
          maxEnergy: 4104,
          lastEnergyRefresh: Date.now(),
          rank: "Beginner",
          level: 1,
          joinDate: firebase.serverTimestamp(),
          lastActive: firebase.serverTimestamp(),
          achievements: [],
          referralCode: generateReferralCode(telegramUser.id, telegramUser.username),
          referredBy: referralCode || null,
          referralCount: 0,
          energyDepletions: 0
        };
        
        await firebase.setDoc(userRef, newUser);
        setUser(newUser);
        setCoins(0);
        setTotalTaps(0);
        setEnergy(4104);
        setUserRank("Beginner");
        setUserLevel(1);
        setReferralCode(newUser.referralCode);
        setAchievements([]);
        
      } else {
        // Existing user
        const userData = userDoc.data();
        await firebase.updateDoc(userRef, {
          lastActive: firebase.serverTimestamp(),
          username: telegramUser.username || userData.username,
          firstName: telegramUser.first_name
        });
        
        // Check energy refresh
        const now = Date.now();
        const storedRefreshTime = userData.lastEnergyRefresh ?? now;
        const timeSinceRefresh = now - storedRefreshTime;
        const twoHoursInMs = 2 * 60 * 60 * 1000;
        
        if (timeSinceRefresh >= twoHoursInMs) {
          setEnergy(4104);
          setLastEnergyRefresh(now);
          await firebase.updateDoc(userRef, { 
            energy: 4104, 
            lastEnergyRefresh: now 
          });
        } else {
          setEnergy(userData.energy ?? 4104);
          setLastEnergyRefresh(storedRefreshTime);
        }
        
        setUser(userData);
        setCoins(userData.coins ?? 0);
        setTotalTaps(userData.totalTaps ?? 0);
        setUserRank(userData.rank ?? "Beginner");
        setUserLevel(userData.level ?? 1);
        setReferralCode(userData.referralCode ?? '');
        setAchievements(userData.achievements ?? []);
        setEnergyDepletions(userData.energyDepletions ?? 0);
      }
      
      await loadLeaderboard();
      
    } catch (error) {
      console.error("Error initializing user:", error);
    }
  }

  // Create mock leaderboard for testing
  function createMockLeaderboard() {
    const mockPlayers = [
      { id: "1", firstName: "Alice", username: "alice123", coins: 25000, totalTaps: 25000 },
      { id: "2", firstName: "Bob", username: "bob456", coins: 18500, totalTaps: 18500 },
      { id: "3", firstName: "Charlie", username: "charlie789", coins: 12300, totalTaps: 12300 },
      { id: "4", firstName: "Diana", username: "diana101", coins: 9800, totalTaps: 9800 },
      { id: "5", firstName: "Eve", username: "eve202", coins: 7600, totalTaps: 7600 },
    ].map((player, index) => ({ ...player, rank: index + 1 }));
    
    setLeaderboard(mockPlayers);
  }

  // Check achievements (works in both modes)
  function checkAchievements(context) {
    const newAchievements = [];
    
    for (const achievement of ACHIEVEMENTS) {
      if (achievements.includes(achievement.id)) continue;
      
      let earned = false;
      
      switch (achievement.requirement.type) {
        case 'totalTaps':
          earned = context.totalTaps >= achievement.requirement.value;
          break;
        case 'coins':
          earned = context.coins >= achievement.requirement.value;
          break;
        case 'energyDepletions':
          earned = context.energyDepletions >= achievement.requirement.value;
          break;
        case 'referrals':
          earned = (user?.referralCount || 0) >= achievement.requirement.value;
          break;
      }
      
      if (earned) {
        newAchievements.push(achievement);
      }
    }
    
    // Award new achievements
    if (newAchievements.length > 0) {
      const achievementIds = newAchievements.map(a => a.id);
      const totalReward = newAchievements.reduce((sum, a) => sum + (a.reward.coins || 0), 0);
      
      // Update local state
      setAchievements(prev => [...prev, ...achievementIds]);
      setCoins(prev => prev + totalReward);
      
      // Show popup for first achievement
      setShowAchievementPopup(newAchievements[0]);
      setTimeout(() => setShowAchievementPopup(null), 3000);
      
      // Update storage in testing mode
      if (TESTING_MODE) {
        const updatedUser = {
          ...user,
          achievements: [...achievements, ...achievementIds],
          coins: coins + totalReward
        };
        localStorage.setItem('tapcoins_user', JSON.stringify(updatedUser));
      }
      
      return newAchievements;
    }
    
    return [];
  }

  // Save to localStorage in testing mode
  function saveToLocalStorage() {
    if (TESTING_MODE && user) {
      const updatedUser = {
        ...user,
        coins,
        totalTaps,
        energy,
        rank: userRank,
        level: userLevel,
        achievements,
        energyDepletions,
        lastEnergyRefresh
      };
      localStorage.setItem('tapcoins_user', JSON.stringify(updatedUser));
    }
  }

  // Update leaderboards
  async function updateLeaderboards(userId, userData) {
    if (TESTING_MODE) {
      // In testing mode, just update local leaderboard
      setLeaderboard(prev => {
        const updated = prev.filter(p => p.id !== String(userId));
        updated.push({
          id: String(userId),
          firstName: userData.firstName,
          username: userData.username,
          coins: userData.coins,
          totalTaps: userData.totalTaps
        });
        return updated.sort((a, b) => b.coins - a.coins).map((p, i) => ({ ...p, rank: i + 1 }));
      });
      return;
    }

    try {
      const firebase = await getFirebaseModules();
      
      const batch = firebase.writeBatch(firebase.db);
      
      const leaderboardData = {
        coins: userData.coins,
        totalTaps: userData.totalTaps,
        username: userData.username,
        firstName: userData.firstName,
        lastUpdated: firebase.serverTimestamp()
      };
      
     const allTimeRef = firebase.doc(firebase.db, "leaderboard", userId);
      batch.set(allTimeRef, leaderboardData, { merge: true });
      
      await batch.commit();
    } catch (error) {
      console.error("Error updating leaderboards:", error);
    }
  }

  // Load leaderboard
 // Alternative: Using subcollections for different leaderboard types
async function loadLeaderboard() {
  if (TESTING_MODE) {
    createMockLeaderboard();
    return;
  }

  try {
    const firebase = await getFirebaseModules();
    
    // Option 2: Use subcollection: leaderboards/allTime/entries
    const leaderboardQuery = firebase.query(
      firebase.collection(firebase.db, "leaderboards", "allTime", "entries"), // ✅ 3 segments (odd number)
      firebase.orderBy("coins", "desc"),
      firebase.limit(50)
    );
    
    const snapshot = await firebase.getDocs(leaderboardQuery);
    const leaderboardData = snapshot.docs.map((doc, index) => ({
      id: doc.id,
      rank: index + 1,
      ...doc.data()
    }));
    
    setLeaderboard(leaderboardData);
  } catch (error) {
    console.error("Error loading leaderboard:", error);
  }
}

// You'd also need to update the updateLeaderboards function:
async function updateLeaderboards(userId, userData) {
  if (TESTING_MODE) {
    setLeaderboard(prev => {
      const updated = prev.filter(p => p.id !== String(userId));
      updated.push({
        id: String(userId),
        firstName: userData.firstName,
        username: userData.username,
        coins: userData.coins,
        totalTaps: userData.totalTaps
      });
      return updated.sort((a, b) => b.coins - a.coins).map((p, i) => ({ ...p, rank: i + 1 }));
    });
    return;
  }

  try {
    const firebase = await getFirebaseModules();
    
    const batch = firebase.writeBatch(firebase.db);
    
    const leaderboardData = {
      coins: userData.coins,
      totalTaps: userData.totalTaps,
      username: userData.username,
      firstName: userData.firstName,
      lastUpdated: firebase.serverTimestamp()
    };
    
    // Update to match the subcollection structure
    const allTimeRef = firebase.doc(firebase.db, "leaderboards", "allTime", "entries", userId);
    batch.set(allTimeRef, leaderboardData, { merge: true });
    
    await batch.commit();
  } catch (error) {
    console.error("Error updating leaderboards:", error);
  }
}

  // Refresh energy
  async function refreshEnergy(userId) {
    if (TESTING_MODE) {
      return;
    }

    try {
      const firebase = await getFirebaseModules();
      
      const userRef = firebase.doc(firebase.db, "users", userId);
      await firebase.updateDoc(userRef, {
        energy: 4104,
        lastEnergyRefresh: Date.now()
      });
    } catch (error) {
      console.error("Error refreshing energy:", error);
    }
  }

  // Handle tap function
  async function handleTap() {
    if (!user || energy <= 0) return;
    
    // Update local state immediately
    const newCoins = coins + 1;
    const newTotalTaps = totalTaps + 1;
    const newEnergy = energy - 1;
    
    setCoins(newCoins);
    setTotalTaps(newTotalTaps);
    setEnergy(newEnergy);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 75);

    // Check if energy depleted
    let newEnergyDepletions = energyDepletions;
    if (newEnergy === 0) {
      newEnergyDepletions = energyDepletions + 1;
      setEnergyDepletions(newEnergyDepletions);
    }

    // Update level and rank
    const newLevel = calculateLevel(newTotalTaps);
    const newRank = calculateRank(newCoins);
    
    if (newLevel !== userLevel) {
      setUserLevel(newLevel);
    }
    if (newRank !== userRank) {
      setUserRank(newRank);
    }

    // Save to localStorage in testing mode
    setTimeout(() => {
      saveToLocalStorage();
    }, 100);

    // Update leaderboards
    await updateLeaderboards(String(user.telegramId), {
      ...user,
      coins: newCoins,
      totalTaps: newTotalTaps
    });

    // Check achievements
    checkAchievements({
      totalTaps: newTotalTaps,
      coins: newCoins,
      energyDepletions: newEnergyDepletions
    });

    // If not in testing mode, use Firebase batch updates
    if (!TESTING_MODE) {
      batchUpdate(1, -1);
    }
  }

  // Batch database updates (only for Firebase mode)
  const batchUpdate = async (coinsChange, energyChange) => {
    if (TESTING_MODE) return;

    if (updateTimeout) {
      clearTimeout(updateTimeout);
    }

    setPendingUpdates(prev => ({
      coins: prev.coins + coinsChange,
      energy: prev.energy + energyChange
    }));

    const newTimeout = setTimeout(async () => {
      if (!user || (pendingUpdates.coins === 0 && pendingUpdates.energy === 0)) return;
      
      try {
        const firebase = await getFirebaseModules();
        
        const userRef = firebase.doc(firebase.db, "users", String(user.telegramId));
        const updates = {};
        
        if (pendingUpdates.coins !== 0) {
          updates.coins = firebase.increment(pendingUpdates.coins);
          updates.totalTaps = firebase.increment(pendingUpdates.coins);
        }
        if (pendingUpdates.energy !== 0) {
          updates.energy = firebase.increment(pendingUpdates.energy);
        }
        
        updates.lastActive = firebase.serverTimestamp();
        
        if (energy <= 1 && pendingUpdates.energy < 0) {
          updates.energyDepletions = firebase.increment(1);
        }
        
        const newLevel = calculateLevel(totalTaps);
        const newRank = calculateRank(coins);
        
        if (newLevel !== userLevel) {
          updates.level = newLevel;
        }
        if (newRank !== userRank) {
          updates.rank = newRank;
        }
        
        if (Object.keys(updates).length > 0) {
          await firebase.updateDoc(userRef, updates);
        }
        
        setPendingUpdates({ coins: 0, energy: 0 });
      } catch (error) {
        console.error("Error updating user data:", error);
      }
    }, 500);

    setUpdateTimeout(newTimeout);
  };

  useEffect(() => {
    return () => {
      if (updateTimeout) {
        clearTimeout(updateTimeout);
      }
    };
  }, [updateTimeout]);

  const formatNumber = (num) => {
    return num.toLocaleString();
  };

  const getMedalInfo = (taps) => {
    if (taps >= 150000) return { name: "Legendary", color: "bg-gradient-to-r from-purple-500 to-pink-500", icon: "👑" };
    if (taps >= 100000) return { name: "Ultra Elite", color: "bg-gradient-to-r from-yellow-400 to-orange-500", icon: "💎" };
    if (taps >= 50000) return { name: "Royal Champion", color: "bg-gradient-to-r from-blue-500 to-purple-500", icon: "🏆" };
    if (taps >= 20000) return { name: "Pro", color: "bg-gradient-to-r from-green-500 to-blue-500", icon: "⭐" };
    if (taps >= 10000) return { name: "Classic", color: "bg-gradient-to-r from-gray-400 to-gray-600", icon: "🥉" };
    return { name: "Beginner", color: "bg-gradient-to-r from-amber-600 to-yellow-600", icon: "🥇" };
  };

  const getTimeUntilRefresh = () => {
    const now = Date.now();
    const timeSinceRefresh = now - lastEnergyRefresh;
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    const timeRemaining = twoHoursInMs - timeSinceRefresh;
    
    if (timeRemaining <= 0) return "Ready to refresh!";
    
    const hours = Math.floor(timeRemaining / (60 * 60 * 1000));
    const minutes = Math.floor((timeRemaining % (60 * 60 * 1000)) / (60 * 1000));
    
    return `${hours}h ${minutes}m until refresh`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-yellow-400 border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
          {TESTING_MODE && <p className="text-yellow-400 text-sm mt-2">Testing Mode Active</p>}
        </div>
      </div>
    );
  }

  const medal = getMedalInfo(totalTaps);

  // Achievement Popup Component
  const AchievementPopup = ({ achievement }) => {
    if (!achievement) return null;
    
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-6 text-center max-w-sm mx-auto animate-bounce">
          <div className="text-4xl mb-2">{achievement.icon}</div>
          <h3 className="text-xl font-bold text-black mb-2">Achievement Unlocked!</h3>
          <h4 className="text-lg font-semibold text-black mb-1">{achievement.name}</h4>
          <p className="text-sm text-black/80 mb-3">{achievement.description}</p>
          <div className="flex items-center justify-center gap-1">
            <span className="text-black font-bold">+{achievement.reward.coins}</span>
            <span className="text-black">coins</span>
          </div>
        </div>
      </div>
    );
  };

  const HomePage = () => (
    <div className="min-h-screen bg-black text-white flex flex-col relative">
      {/* Testing Mode Indicator */}
      {TESTING_MODE && (
        <div className="bg-yellow-600 text-black text-center py-1 text-xs">
          🧪 TESTING MODE - Change TESTING_MODE to false for Firebase
        </div>
      )}
      
      {/* Achievement Popup */}
      <AchievementPopup achievement={showAchievementPopup} />
      
      {/* Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-black text-xs font-bold">△</span>
          </div>
          <span className="text-white font-medium text-sm">TAP COINS</span>
          <div className={`px-2 py-1 rounded-full ${medal.color}`}>
            <span className="text-white text-xs font-medium">{medal.name}</span>
          </div>
        </div>
        <div className="text-gray-400 text-xs">
          @{user?.username || user?.firstName || "user"}
        </div>
      </div>

      {/* Balance Display */}
      <div className="flex flex-col items-center mt-6 mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center">
            <span className="text-black text-lg font-bold">$</span>
          </div>
          <span className="text-5xl font-bold text-white">{formatNumber(coins)}</span>
        </div>
        
        <div className="flex items-center gap-4 text-gray-400 text-xs">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3" />
            <span>{userRank}</span>
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            <span>Level {userLevel}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{medal.icon}</span>
            <span>{formatNumber(totalTaps)} taps</span>
          </div>
        </div>
      </div>

      {/* Tap Button */}
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="relative">
          <div className="absolute inset-0 bg-white/5 rounded-full blur-xl scale-110"></div>
          
          <button
            onClick={handleTap}
            disabled={energy <= 0}
            className={`relative w-48 h-48 bg-black border-4 border-white rounded-full flex items-center justify-center transition-all duration-75 active:scale-95 ${
              isAnimating ? 'scale-95 border-yellow-400' : 'scale-100'
            } ${energy <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-gray-300 hover:scale-105'}`}
          >
            <div className="w-0 h-0 border-l-[24px] border-r-[24px] border-b-[36px] border-l-transparent border-r-transparent border-b-white z-10"></div>
          </button>
        </div>
      </div>

      {/* Energy Bar */}
      <div className="px-4 pb-6">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <span className="text-lg font-bold text-white">{energy}</span>
          <span className="text-gray-400 text-sm">/ {maxEnergy}</span>
        </div>
        
        <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
          <div 
            className="bg-gradient-to-r from-yellow-400 to-yellow-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(energy / maxEnergy) * 100}%` }}
          ></div>
        </div>
        
        <div className="text-center text-gray-400 text-xs">
          {energy > 0 ? `${energy} taps left` : 'No energy left'}
        </div>
        
        <div className="text-center text-gray-500 text-xs mt-1">
          {energy < maxEnergy ? getTimeUntilRefresh() : 'Energy full!'}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-gray-900/90 backdrop-blur-sm border-t border-gray-700">
        <div className="flex justify-around items-center py-3">
          <button 
            onClick={() => setCurrentPage('home')}
            className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'home' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">HOME</span>
          </button>
          
          <button 
            onClick={() => setCurrentPage('leaderboard')}
            className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'leaderboard' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            <Trophy className="w-6 h-6" />
            <span className="text-xs font-medium">LEADERBOARD</span>
          </button>
          
          <button 
            onClick={() => setCurrentPage('achievements')}
            className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'achievements' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            <Star className="w-6 h-6" />
            <span className="text-xs font-medium">ACHIEVEMENTS</span>
          </button>
          
          <button 
            onClick={() => setCurrentPage('earn')}
            className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'earn' ? 'text-yellow-400' : 'text-gray-400'}`}
          >
            <DollarSign className="w-6 h-6" />
            <span className="text-xs font-medium">EARN</span>
          </button>
          
          <button className="flex flex-col items-center gap-1 p-3 text-gray-400">
            <HelpCircle className="w-6 h-6" />
            <span className="text-xs font-medium">?</span>
          </button>
        </div>
      </div>
    </div>
  );

  const LeaderboardPage = () => (
    <div className="min-h-screen bg-black text-white">
      {TESTING_MODE && (
        <div className="bg-yellow-600 text-black text-center py-1 text-xs">
          🧪 TESTING MODE - Mock leaderboard data
        </div>
      )}
      
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button 
          onClick={() => setCurrentPage('home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Leaderboard</h1>
        <div></div>
      </div>
      
      <div className="p-4">
        {leaderboard.length > 0 ? (
          <div className="space-y-3">
            {leaderboard.slice(0, 10).map((player, index) => (
              <div key={player.id} className="flex items-center gap-3 bg-gray-900 rounded-lg p-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  index === 0 ? 'bg-yellow-400 text-black' :
                  index === 1 ? 'bg-gray-400 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-gray-700 text-white'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{player.firstName}</div>
                  <div className="text-xs text-gray-400">@{player.username || 'user'}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold">{formatNumber(player.coins)}</div>
                  <div className="text-xs text-gray-400">coins</div>
                </div>
              </div>
            ))}
            
            {/* Add current user to leaderboard if not in top 10 */}
            {user && leaderboard.findIndex(p => p.id === String(user.telegramId)) === -1 && (
              <div className="mt-6 pt-3 border-t border-gray-700">
                <div className="flex items-center gap-3 bg-blue-900/30 rounded-lg p-3 border border-blue-500">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold bg-blue-500 text-white">
                    ?
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{user.firstName} (You)</div>
                    <div className="text-xs text-gray-400">@{user.username || 'user'}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatNumber(coins)}</div>
                    <div className="text-xs text-gray-400">coins</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-gray-400 mt-20">
            <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p>No players yet!</p>
          </div>
        )}
      </div>
    </div>
  );

  const AchievementsPage = () => (
    <div className="min-h-screen bg-black text-white">
      {TESTING_MODE && (
        <div className="bg-yellow-600 text-black text-center py-1 text-xs">
          🧪 TESTING MODE - Achievement system working
        </div>
      )}
      
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button 
          onClick={() => setCurrentPage('home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Achievements</h1>
        <div></div>
      </div>
      
      <div className="p-4">
        <div className="grid gap-3">
          {ACHIEVEMENTS.map((achievement) => {
            const isUnlocked = achievements.includes(achievement.id);
            
            // Calculate progress
            let progress = 0;
            let progressText = '';
            
            switch (achievement.requirement.type) {
              case 'totalTaps':
                progress = Math.min(totalTaps / achievement.requirement.value, 1);
                progressText = `${formatNumber(totalTaps)} / ${formatNumber(achievement.requirement.value)} taps`;
                break;
              case 'coins':
                progress = Math.min(coins / achievement.requirement.value, 1);
                progressText = `${formatNumber(coins)} / ${formatNumber(achievement.requirement.value)} coins`;
                break;
              case 'energyDepletions':
                progress = Math.min(energyDepletions / achievement.requirement.value, 1);
                progressText = `${energyDepletions} / ${achievement.requirement.value} times`;
                break;
              case 'referrals':
                const referralCount = user?.referralCount || 0;
                progress = Math.min(referralCount / achievement.requirement.value, 1);
                progressText = `${referralCount} / ${achievement.requirement.value} friends`;
                break;
            }
            
            return (
              <div key={achievement.id} className={`p-4 rounded-lg border-2 ${
                isUnlocked ? 'bg-green-900/30 border-green-500' : 'bg-gray-900 border-gray-700'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{achievement.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{achievement.name}</h3>
                      {isUnlocked && <div className="text-green-400">✓</div>}
                    </div>
                    <p className="text-sm text-gray-400 mb-1">{achievement.description}</p>
                    
                    {/* Progress bar */}
                    {!isUnlocked && (
                      <div className="mb-2">
                        <div className="w-full bg-gray-700 rounded-full h-2 mb-1">
                          <div 
                            className="bg-yellow-400 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress * 100}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500">{progressText}</div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-yellow-400">+{achievement.reward.coins} coins</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-500 capitalize">{achievement.category}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h3 className="font-bold mb-2">Your Progress</h3>
          <div className="text-sm text-gray-400 space-y-1">
            <div>Achievements Unlocked: {achievements.length}/{ACHIEVEMENTS.length}</div>
            <div>Total Taps: {formatNumber(totalTaps)}</div>
            <div>Total Coins: {formatNumber(coins)}</div>
            <div>Level: {userLevel}</div>
            <div>Rank: {userRank}</div>
            <div>Energy Depletions: {energyDepletions}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const EarnPage = () => (
    <div className="min-h-screen bg-black text-white">
      {TESTING_MODE && (
        <div className="bg-yellow-600 text-black text-center py-1 text-xs">
          🧪 TESTING MODE - Referral features simulated
        </div>
      )}
      
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button 
          onClick={() => setCurrentPage('home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">Earn More</h1>
        <div></div>
      </div>
      
      <div className="p-4">
        <div className="space-y-4">
          {/* Referral Card */}
          <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="text-2xl">👥</div>
              <div>
                <h3 className="font-bold">Invite Friends</h3>
                <p className="text-sm text-gray-300">Earn 5,000 coins for each friend</p>
              </div>
            </div>
            <div className="bg-black/30 rounded p-3 mb-3">
              <div className="text-xs text-gray-400 mb-1">Your Referral Code:</div>
              <div className="font-mono text-lg">{referralCode}</div>
            </div>
            <button 
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: 'Join TAP COINS!',
                    text: `Use my referral code: ${referralCode}`,
                    url: window.location.href
                  });
                } else {
                  navigator.clipboard.writeText(`Join TAP COINS with my referral code: ${referralCode}\n${window.location.href}`);
                  alert('Referral link copied to clipboard!');
                }
              }}
              className="w-full bg-white text-black font-bold py-2 rounded-lg"
            >
              Share Invite Link
            </button>
          </div>

          {/* Achievement Progress Card */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Star className="w-5 h-5" />
              Quick Achievements
            </h3>
            <div className="space-y-3">
              {ACHIEVEMENTS.slice(0, 3).map((achievement) => {
                const isUnlocked = achievements.includes(achievement.id);
                if (isUnlocked) return null;
                
                let progress = 0;
                switch (achievement.requirement.type) {
                  case 'totalTaps':
                    progress = Math.min(totalTaps / achievement.requirement.value, 1);
                    break;
                  case 'coins':
                    progress = Math.min(coins / achievement.requirement.value, 1);
                    break;
                }
                
                return (
                  <div key={achievement.id} className="flex items-center justify-between p-3 bg-gray-800 rounded">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{achievement.icon}</span>
                      <div>
                        <div className="font-medium text-sm">{achievement.name}</div>
                        <div className="text-xs text-gray-400">{Math.round(progress * 100)}% complete</div>
                      </div>
                    </div>
                    <div className="text-yellow-400 font-bold text-sm">+{achievement.reward.coins}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daily Tasks */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-bold mb-3 flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Daily Tasks
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div>
                  <div className="font-medium">Tap 100 times today</div>
                  <div className="text-xs text-gray-400">Progress: {Math.min(totalTaps % 100, 100)}/100</div>
                </div>
                <div className="text-yellow-400 font-bold">+500</div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div>
                  <div className="font-medium">Use all energy</div>
                  <div className="text-xs text-gray-400">{energyDepletions > 0 ? 'Completed today!' : 'Drain your energy bar completely'}</div>
                </div>
                <div className="text-yellow-400 font-bold">+1000</div>
              </div>
            </div>
          </div>

          {/* Social Tasks */}
          <div className="bg-gray-900 rounded-lg p-4">
            <h3 className="font-bold mb-3">Social Tasks</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div>
                  <div className="font-medium">Follow on Twitter</div>
                  <div className="text-xs text-gray-400">@tapcoinsgame</div>
                </div>
                <div className="text-yellow-400 font-bold">+2000</div>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded">
                <div>
                  <div className="font-medium">Join Telegram Channel</div>
                  <div className="text-xs text-gray-400">Get updates and tips</div>
                </div>
                <div className="text-yellow-400 font-bold">+2000</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const OtherPage = ({ title, icon: Icon, color }) => (
    <div className="min-h-screen bg-black text-white">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <button 
          onClick={() => setCurrentPage('home')}
          className="text-gray-400 hover:text-white"
        >
          ← Back
        </button>
        <h1 className="text-xl font-bold">{title}</h1>
        <div></div>
      </div>
      
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <Icon className={`w-16 h-16 ${color} mx-auto mb-4`} />
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          <p className="text-gray-400">Coming soon...</p>
        </div>
      </div>
    </div>
  );

  // Bottom Navigation Component
  const BottomNavigation = () => (
    <div className="bg-gray-900/90 backdrop-blur-sm border-t border-gray-700 fixed bottom-0 left-0 right-0">
      <div className="flex justify-around items-center py-3">
        <button 
          onClick={() => setCurrentPage('home')}
          className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'home' ? 'text-yellow-400' : 'text-gray-400'}`}
        >
          <Home className="w-6 h-6" />
          <span className="text-xs font-medium">HOME</span>
        </button>
        
        <button 
          onClick={() => setCurrentPage('leaderboard')}
          className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'leaderboard' ? 'text-yellow-400' : 'text-gray-400'}`}
        >
          <Trophy className="w-6 h-6" />
          <span className="text-xs font-medium">LEADERBOARD</span>
        </button>
        
        <button 
          onClick={() => setCurrentPage('achievements')}
          className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'achievements' ? 'text-yellow-400' : 'text-gray-400'}`}
        >
          <Star className="w-6 h-6" />
          <span className="text-xs font-medium">ACHIEVEMENTS</span>
        </button>
        
        <button 
          onClick={() => setCurrentPage('earn')}
          className={`flex flex-col items-center gap-1 p-3 ${currentPage === 'earn' ? 'text-yellow-400' : 'text-gray-400'}`}
        >
          <DollarSign className="w-6 h-6" />
          <span className="text-xs font-medium">EARN</span>
        </button>
        
        <button className="flex flex-col items-center gap-1 p-3 text-gray-400">
          <HelpCircle className="w-6 h-6" />
          <span className="text-xs font-medium">?</span>
        </button>
      </div>
    </div>
  );

  // Render current page
  switch (currentPage) {
    case 'leaderboard':
      return (
        <div>
          <LeaderboardPage />
          <BottomNavigation />
        </div>
      );
    case 'achievements':
      return (
        <div>
          <AchievementsPage />
          <BottomNavigation />
        </div>
      );
    case 'earn':
      return (
        <div>
          <EarnPage />
          <BottomNavigation />
        </div>
      );
    case 'booster':
      return (
        <div>
          <OtherPage title="Boosters" icon={Zap} color="text-purple-400" />
          <BottomNavigation />
        </div>
      );
    default:
      return <HomePage />;
  }
}