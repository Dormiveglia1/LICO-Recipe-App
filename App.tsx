import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import * as Notifications from "expo-notifications";
import * as Clipboard from "expo-clipboard";
import { useFonts } from "expo-font";
import { Picker } from "@react-native-picker/picker";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseKey, supabaseUrl } from "./lib/supabase";
import {
  AppState,
  Animated,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type MenuStage = "想吃" | "计划本周做" | "今天做" | "已完成";
type RecipeStep = { text: string; image?: string; imagePath?: string };
type RecipeId = string | number;
type CookReview = {
  id: string;
  author_name: string;
  text: string;
  created_at: string;
};
type Ingredient =
  | string
  | { name: string; quantity: string; unit: string; type?: string };
type Recipe = {
  id: RecipeId;
  name: string;
  category: string;
  taste: string;
  time: string;
  difficulty: string;
  emoji: string;
  color: string;
  tags: string[];
  ingredients: Ingredient[];
  steps: any[];
  cover?: string;
  coverPath?: string;
  note: string;
  cookedCount?: number;
  lastCookedAt?: string;
  updatedAt?: string;
  reviews?: CookReview[];
};
type IngredientDraft = {
  name: string;
  quantity: string;
  unit: string;
  type: string;
};
type StepDraft = RecipeStep;

const stages: MenuStage[] = ["想吃", "计划本周做", "今天做", "已完成"];
const stageSticker: Record<MenuStage, string> = {
  想吃: "♡",
  计划本周做: "✎",
  今天做: "⌇",
  已完成: "✦",
};
const defaultRecipes: Recipe[] = [
  {
    id: 1,
    name: "番茄牛腩煲",
    category: "主菜",
    taste: "酸甜",
    time: "90 分钟",
    difficulty: "普通",
    emoji: "🍅",
    color: "#E99870",
    tags: ["周末做", "下饭"],
    ingredients: ["牛腩 500g", "番茄 3 个", "土豆 1 个"],
    steps: [
      { text: "牛腩焯水后沥干。" },
      { text: "炒香番茄，加水炖至软烂。" },
      { text: "加入牛腩和土豆，小火炖 60 分钟。" },
    ],
    note: "浓郁又暖呼呼的一锅。",
  },
  {
    id: 2,
    name: "蒜蓉粉丝虾",
    category: "海鲜",
    taste: "鲜香",
    time: "20 分钟",
    difficulty: "简单",
    emoji: "🦐",
    color: "#E9B77E",
    tags: ["快手", "Chestnut认证"],
    ingredients: ["鲜虾 12 只", "粉丝 1 把", "大蒜 1 头"],
    steps: [
      { text: "粉丝泡软铺盘。" },
      { text: "虾开背后铺在粉丝上。" },
      { text: "铺蒜蓉，蒸 8 分钟。" },
    ],
    note: "今晚想吃这一口鲜。",
  },
  {
    id: 3,
    name: "奶油蘑菇意面",
    category: "主食",
    taste: "奶香",
    time: "25 分钟",
    difficulty: "普通",
    emoji: "🍝",
    color: "#C7B28A",
    tags: ["约会晚餐"],
    ingredients: ["意面 200g", "口蘑 8 个", "淡奶油 150ml"],
    steps: [
      { text: "意面煮至八分熟。" },
      { text: "炒香口蘑，倒入淡奶油。" },
      { text: "拌入意面，收汁即可。" },
    ],
    note: "做过 6 次的固定节目。",
  },
  {
    id: 4,
    name: "凉拌黄瓜",
    category: "凉菜",
    taste: "酸辣",
    time: "10 分钟",
    difficulty: "简单",
    emoji: "🥒",
    color: "#94B28D",
    tags: ["快手", "少辣"],
    ingredients: ["黄瓜 2 根", "蒜末 1 勺", "香醋 2 勺"],
    steps: [
      { text: "黄瓜拍碎后切段。" },
      { text: "加入调味料，抓拌均匀。" },
      { text: "冷藏 5 分钟更好吃。" },
    ],
    note: "冰箱常备小快乐。",
  },
];
const categories = [
  "全部",
  "主菜",
  "蔬菜",
  "汤",
  "凉菜",
  "主食",
  "海鲜",
  "小吃",
  "甜品",
  "零食",
];
const ingredientTypes = [
  "蔬菜",
  "肉蛋海鲜",
  "主食",
  "调味料",
  "乳制品",
  "其他",
];
const ingredientText = (item: Ingredient) =>
  typeof item === "string"
    ? item
    : `${item.name} ${item.quantity}${item.unit}`.trim();
const ingredientType = (item: Ingredient) =>
  typeof item === "string" ? "" : item.type || "";
const shoppingIngredient = (raw: Ingredient) => {
  const text = ingredientText(raw);
  const match = text
    .trim()
    .match(/^(.*?)\s*([\d.]+)?\s*(kg|千克|g|克|L|升|ml|毫升|个|勺|把|适量)?$/i);
  const name = match?.[1]?.trim() || text;
  const amount = match?.[2] ? Number(match[2]) : null;
  const rawUnit = match?.[3] || "";
  const unit = /^(kg|千克|g|克)$/i.test(rawUnit)
    ? "克"
    : /^(L|升|ml|毫升)$/i.test(rawUnit)
      ? "毫升"
      : rawUnit;
  const quantity = amount === null ? null : /^(kg|千克)$/i.test(rawUnit) ? amount * 1000 : /^(L|升)$/i.test(rawUnit) ? amount * 1000 : amount;
  return { name, unit, quantity, key: `${name}|${unit}` };
};
const recipePurchaseKey = (id: RecipeId) => `recipe:${id}`;
const secondsFromCookTime = (time?: string) => {
  const value = time || "";
  const hours = Number(value.match(/(\d+(?:\.\d+)?)\s*(?:小时|h)/i)?.[1] || 0);
  const minutes = Number(value.match(/(\d+)\s*(?:分钟|分|min)/i)?.[1] || 0);
  const total = Math.round(hours * 3600 + minutes * 60);
  return total > 0 ? total : 20 * 60;
};
const chestnutMascot = require("./assets/chestnut-kitchen-mascot-v2.png");
const paperBackground = require("./assets/cream-paper-background.png");
const shoppingPaper = require("./assets/shopping-grid-note-v2.png");
const doodleBasket = require("./assets/doodle-shopping-basket.png");
const doodleChestnut = require("./assets/doodle-chestnut.png");
const doodleTableSetting = require("./assets/doodle-table-setting.png");
const kitchenStatArt = [
  require("./assets/stat-recipes-handdrawn.png"),
  require("./assets/stat-cooking-handdrawn.png"),
  require("./assets/stat-menu-handdrawn.png"),
];
const navArt = {
  菜谱本: require("./assets/nav-recipes-transparent.png"),
  菜单: require("./assets/nav-menu-transparent.png"),
  计时器: require("./assets/nav-timer-transparent.png"),
  我的: require("./assets/nav-profile-transparent.png"),
};
const recipeStyle = (category: string) =>
  ({
    主菜: ["🍲", "#E99870"],
    蔬菜: ["🥬", "#94B28D"],
    汤: ["🥣", "#D9B56F"],
    凉菜: ["🥒", "#94B28D"],
    主食: ["🍝", "#C7B28A"],
    海鲜: ["🦐", "#E9B77E"],
    小吃: ["🥟", "#D7B58B"],
    甜品: ["🍰", "#E9B7B0"],
    零食: ["🍪", "#D7B58B"],
  })[category] || ["🍳", "#D7B58B"];

const withTimeout = <T,>(promise: Promise<T>, message: string, ms = 12000) =>
  new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });

const readFamilyRows = async <T,>(
  path: string,
  accessToken: string,
  message: string,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok)
      throw new Error(payload?.message || payload?.hint || message);
    return payload as T;
  } catch (error: any) {
    if (error?.name === "AbortError") throw new Error(message);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export default function App() {
  const [fontsLoaded] = useFonts({
    ZCOOLKuaiLe: require("./assets/ZCOOLKuaiLe-Regular.ttf"),
    LongCang: require("./assets/LongCang-Regular.ttf"),
  });
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [familyId, setFamilyId] = useState<string | null>(null);
  const [familyResolved, setFamilyResolved] = useState(false);
  const [familyInviteCode, setFamilyInviteCode] = useState("");
  const [familyEditing, setFamilyEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<"家庭" | "偏好">(
    "偏好",
  );
  const [familyOwnerId, setFamilyOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<
    {
      user_id: string;
      joined_at?: string;
      display_name?: string;
      bio?: string;
      avatar_url?: string;
    }[]
  >([]);
  const [profile, setProfile] = useState({
    display_name: "栗刻成员",
    bio: "",
    avatar_url: "",
  });
  const [profileEditing, setProfileEditing] = useState(false);
  const [memberNotes, setMemberNotes] = useState<Record<string, string>>({});
  const [noteTarget, setNoteTarget] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [memberProfileId, setMemberProfileId] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [cookCountText, setCookCountText] = useState("");
  const [cookCountEditing, setCookCountEditing] = useState(false);
  const [cookCountStatus, setCookCountStatus] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [familyName, setFamilyName] = useState("我们的厨房");
  const [inviteCode, setInviteCode] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [tab, setTab] = useState<"菜谱本" | "菜单" | "计时器" | "我的">(
    "菜谱本",
  );
  const [recipeList, setRecipeList] = useState(defaultRecipes);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [ingredientFilter, setIngredientFilter] = useState("");
  const [tasteFilter, setTasteFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<Recipe | null>(null);
  const [menu, setMenu] = useState<Record<string, MenuStage>>({
    1: "计划本周做",
    2: "今天做",
    3: "想吃",
    4: "今天做",
  });
  const [menuNotes, setMenuNotes] = useState<Record<string, string>>({});
  const [menuNoteId, setMenuNoteId] = useState<RecipeId | null>(null);
  const [menuNoteText, setMenuNoteText] = useState("");
  const [stage, setStage] = useState<MenuStage>("今天做");
  const [shoppingStages, setShoppingStages] = useState<MenuStage[]>(["今天做"]);
  const [shoppingView, setShoppingView] = useState<"食材" | "菜品">("食材");
  const [checked, setChecked] = useState<string[]>([]);
  const [dark, setDark] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<
    "未询问" | "已允许" | "未允许"
  >("未询问");
  const [seconds, setSeconds] = useState(15 * 60);
  // Keep the seconds wheel on its middle lap so 59 → 0 can be scrolled through naturally.
  const [secondWheelIndex, setSecondWheelIndex] = useState(60);
  const [running, setRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [timerRecipe, setTimerRecipe] = useState<Recipe | null>(null);
  const [favorites, setFavorites] = useState<RecipeId[]>([]);
  const [recentRecipeIds, setRecentRecipeIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<
    "最近添加" | "最近做过" | "做过最多"
  >("最近添加");
  const [syncStatus, setSyncStatus] = useState("正在同步…");
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [randomPicking, setRandomPicking] = useState(false);
  const [randomName, setRandomName] = useState("");
  const [randomCategory, setRandomCategory] = useState("主菜");
  const randomTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const webMinuteWheelRef = useRef<ScrollView | null>(null);
  const webSecondWheelRef = useRef<ScrollView | null>(null);
  const webWheelSettleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerNotificationRef = useRef<string | null>(null);
  const shoppingCheckLock = useRef<Record<string, number>>({});
  const pendingShoppingChecks = useRef<
    Record<string, { checked: boolean; expiresAt: number }>
  >({});
  const recipeSaveLock = useRef(false);
  const signedImageCache = useRef<Record<string, { url: string; expiresAt: number }>>({});
  const familySyncLock = useRef(false);
  const familySyncQueued = useRef(false);
  const familySyncPausedUntil = useRef(0);
  const syncedFamilyId = useRef<string | null>(null);
  const familySyncSucceeded = useRef(false);
  const familySyncRun = useRef(0);
  const remoteRecipeSnapshot = useRef("");
  const legacyStateRef = useRef<any>(null);
  const legacyRecoveryPrompted = useRef(false);
  const legacyRestoreLock = useRef(false);
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [composer, setComposer] = useState(false);
  const [ready, setReady] = useState(false);
  const [familyCacheReady, setFamilyCacheReady] = useState(false);
  const [legacyRecipeCount, setLegacyRecipeCount] = useState(0);
  useEffect(
    () => () => {
      if (randomTimerRef.current) clearInterval(randomTimerRef.current);
      if (webWheelSettleTimer.current) clearTimeout(webWheelSettleTimer.current);
    },
    [],
  );
  const createEmptyDraft = () => ({
    name: "",
    category: "主菜",
    taste: "",
    time: "",
    difficulty: "简单",
    tags: "",
    note: "",
    emoji: "🍳",
    cover: undefined as string | undefined,
    coverPath: undefined as string | undefined,
    ingredients: [
      { name: "", quantity: "", unit: "克", type: "其他" },
    ] as IngredientDraft[],
    steps: [{ text: "" }] as any[],
  });
  const [draft, setDraft] = useState(createEmptyDraft);
  const restoredDraftFamily = useRef<string | null>(null);
  const [tagEntry, setTagEntry] = useState("");
  const [tagAdding, setTagAdding] = useState(false);
  const draftTagList = draft.tags
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean);
  const addDraftTag = () => {
    const value = tagEntry.trim();
    if (!value || draftTagList.includes(value)) return setTagEntry("");
    setDraft({ ...draft, tags: [...draftTagList, value].join("，") });
    setTagEntry("");
    setTagAdding(false);
  };
  const removeDraftTag = (tag: string) =>
    setDraft({
      ...draft,
      tags: draftTagList.filter((item) => item !== tag).join("，"),
    });
  const [editingId, setEditingId] = useState<RecipeId | null>(null);
  const [sheet, setSheet] = useState<{
    title: string;
    subtitle?: string;
    options: { label: string; destructive?: boolean; action: () => void }[];
  } | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) =>
      setSession(next),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!session) {
      setFamilyId(null);
      setFamilyResolved(true);
      setAuthMessage("");
      return;
    }
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    setFamilyResolved(false);
    const resolveFamily = async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("family_id")
        .eq("user_id", session.user.id)
        .maybeSingle();
        if (!active) return;
      if (error && attempts++ === 0) {
        retryTimer = setTimeout(resolveFamily, 800);
        return;
      }
      if (error) {
        setAuthMessage("读取家庭失败，请检查网络后重试。");
        setFamilyId(null);
      } else {
        setFamilyId(data?.family_id || null);
        setAuthMessage("");
      }
      setFamilyResolved(true);
    };
    void resolveFamily();
    return () => {
      active = false;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [session]);
  useEffect(() => {
    if (!session) return;
    supabase
      .from("profiles")
      .upsert(
        {
          id: session.user.id,
          display_name: session.user.email?.split("@")[0] || "栗刻成员",
        },
        { onConflict: "id", ignoreDuplicates: true },
      )
      .then(() =>
        supabase
          .from("profiles")
          .select("display_name, bio, avatar_url")
          .eq("id", session.user.id)
          .single()
          .then(
            async ({ data }) =>
              data &&
              setProfile({
                ...data,
                avatar_url: (await imageUrl(data.avatar_url)) || "",
              }),
          ),
      );
  }, [session]);
  useEffect(() => {
    if (!familyId) return setFamilyInviteCode("");
    supabase
      .from("families")
      .select("invite_code, name")
      .eq("id", familyId)
      .single()
      .then(({ data }) => {
        setFamilyInviteCode(data?.invite_code || "");
        if (data?.name) setFamilyName(data.name);
      });
  }, [familyId]);
  useEffect(() => {
    if (!familyId) {
      setFamilyOwnerId(null);
      setMembers([]);
      return;
    }
    let active = true;
    const loadMembers = async () => {
      const [family, memberList] = await Promise.all([
        supabase
          .from("families")
          .select("owner_id")
          .eq("id", familyId)
          .single(),
        supabase
          .from("family_members")
          .select("user_id, joined_at")
          .eq("family_id", familyId),
      ]);
      const ids = (memberList.data || []).map((member) => member.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, bio, avatar_url")
        .in("id", ids);
      const profileMap = Object.fromEntries(
        await Promise.all(
          (profiles || []).map(async (item) => [
            item.id,
            { ...item, avatar_url: (await imageUrl(item.avatar_url)) || "" },
          ]),
        ),
      );
      if (!active) return;
      setFamilyOwnerId(family.data?.owner_id || null);
      setMembers(
        (memberList.data || []).map((member) => ({
          ...member,
          ...profileMap[member.user_id],
        })),
      );
    };
    loadMembers();
    const channel = supabase
      .channel(`members-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "family_members",
          filter: `family_id=eq.${familyId}`,
        },
        loadMembers,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        loadMembers,
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [familyId]);
  useEffect(() => {
    if (!familyId || !session) return setMemberNotes({});
    supabase
      .from("member_notes")
      .select("member_id, note")
      .eq("family_id", familyId)
      .eq("author_id", session.user.id)
      .then(({ data }) =>
        setMemberNotes(
          Object.fromEntries(
            (data || []).map((item) => [item.member_id, item.note]),
          ),
        ),
      );
  }, [familyId, session]);
  const Alert = {
    alert: (
      title: string,
      subtitle?: string,
      buttons?: { text: string; style?: string; onPress?: () => void }[],
    ) =>
      setSheet({
        title,
        subtitle,
        options: (buttons || [])
          .filter((item) => item.style !== "cancel")
          .map((item) => ({
            label: item.text,
            destructive: item.style === "destructive",
            action: item.onPress || (() => undefined),
          })),
      }),
  };
  const imageUrl = async (path?: string | null) => {
    if (!path || path.startsWith("file:") || path.startsWith("http"))
      return path || undefined;
    const cached = signedImageCache.current[path];
    if (cached && cached.expiresAt > Date.now()) return cached.url;
    const { data } = await supabase.storage
      .from("recipe-images")
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (data?.signedUrl)
      signedImageCache.current[path] = {
        url: data.signedUrl,
        expiresAt: Date.now() + 6 * 24 * 60 * 60 * 1000,
      };
    return data?.signedUrl;
  };
  const uploadImage = async (uri: string | undefined, path: string) => {
    if (!uri) return undefined;
    if (!uri.startsWith("file:")) return path;
    const bytes = await (await fetch(uri)).arrayBuffer();
    const { error } = await supabase.storage
      .from("recipe-images")
      .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw error;
    return path;
  };
  const saveProfile = async () => {
    if (!session || !familyId) return;
    try {
      const avatarPath =
        (await uploadImage(
          profile.avatar_url,
          `${familyId}/avatars/${session.user.id}.jpg`,
        )) ||
        profile.avatar_url ||
        null;
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: profile.display_name.trim() || "栗刻成员",
          bio: profile.bio.trim(),
          avatar_url: avatarPath,
        })
        .eq("id", session.user.id);
      if (error) throw error;
      setProfile({
        ...profile,
        avatar_url: (await imageUrl(avatarPath)) || "",
      });
      setProfileEditing(false);
    } catch (error: any) {
      Alert.alert("资料保存失败", error.message || "请稍后重试。");
    }
  };
  const saveMemberNote = async () => {
    if (!familyId || !session || !noteTarget) return;
    const { error } = await supabase.from("member_notes").upsert({
      family_id: familyId,
      author_id: session.user.id,
      member_id: noteTarget,
      note: noteText.trim(),
      updated_at: new Date().toISOString(),
    });
    if (error) return Alert.alert("备注保存失败", error.message);
    setMemberNotes((notes) => ({ ...notes, [noteTarget]: noteText.trim() }));
    setNoteTarget(null);
  };
  const restoreLegacyFamilyData = async () => {
    const legacy = legacyStateRef.current;
    if (
      legacyRestoreLock.current ||
      !familyId ||
      !session ||
      !legacy?.recipeList?.length
    )
      return;
    legacyRestoreLock.current = true;
    // Clear the in-memory source immediately so a second tap cannot replay it.
    legacyStateRef.current = null;
    setLegacyRecipeCount(0);
    try {
      setSyncStatus("正在恢复旧菜谱…");
      for (const oldRecipe of legacy.recipeList as Recipe[]) {
        const coverPath = oldRecipe.coverPath ||
          (oldRecipe.cover && !oldRecipe.cover.startsWith("file:") && !oldRecipe.cover.startsWith("http")
            ? oldRecipe.cover
            : null);
        const steps = (oldRecipe.steps || []).map((step) => ({
          text: step.text,
          imagePath: step.imagePath ||
            (step.image && !step.image.startsWith("file:") && !step.image.startsWith("http")
              ? step.image
              : undefined),
        }));
        const { data, error } = await supabase
          .from("recipes")
          .insert({
            family_id: familyId,
            name: oldRecipe.name,
            category: oldRecipe.category,
            taste: oldRecipe.taste,
            cook_time: oldRecipe.time,
            tags: oldRecipe.tags || [],
            ingredients: oldRecipe.ingredients || [],
            steps,
            cover_url: coverPath,
            note: oldRecipe.note,
            created_by: session.user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        const oldStage = legacy.menu?.[String(oldRecipe.id)];
        if (data && oldStage)
          await supabase.from("menu_items").upsert({
            recipe_id: data.id,
            family_id: familyId,
            stage: oldStage,
            updated_at: new Date().toISOString(),
          });
      }
      await AsyncStorage.setItem(`lico-legacy-restored:${familyId}`, "1");
      setSyncAttempt((value) => value + 1);
      Alert.alert("旧菜谱已恢复", "已同步到当前家庭。未上传过的本地照片需要重新选择。 ");
    } catch (error: any) {
      legacyStateRef.current = legacy;
      setLegacyRecipeCount(legacy.recipeList.length);
      setSyncStatus("同步失败，点这里重试");
      Alert.alert("恢复失败", error.message || "请检查网络后再试。 ");
    } finally {
      legacyRestoreLock.current = false;
    }
  };
  const offerLegacyRecovery = async () => {
    if (!legacyStateRef.current) {
      const saved = await AsyncStorage.getItem("lico-state");
      if (saved) legacyStateRef.current = JSON.parse(saved);
    }
    const count = legacyStateRef.current?.recipeList?.length || 0;
    if (!count)
      return Alert.alert("未找到旧菜谱", "这台设备上没有可恢复的旧本地菜谱。 ");
    setLegacyRecipeCount(count);
    setSheet({
      title: "恢复本机旧菜谱？",
      subtitle: `找到 ${count} 道旧菜谱。恢复后会写入当前家庭，并同步到其他设备。`,
      options: [{ label: "恢复到当前家庭", action: restoreLegacyFamilyData }],
    });
  };
  const duplicateRecipeKey = (recipe: Recipe) =>
    JSON.stringify({
      name: recipe.name.trim(),
      category: recipe.category,
      taste: recipe.taste,
      time: recipe.time,
      difficulty: recipe.difficulty,
      tags: [...(recipe.tags || [])].sort(),
      ingredients: recipe.ingredients,
      steps: (recipe.steps || []).map((step) => ({
        text: step.text,
        imagePath: step.imagePath || "",
      })),
      note: recipe.note,
    });
  const cleanDuplicateRecipes = () => {
    const groups = new Map<string, Recipe[]>();
    recipeList.forEach((recipe) => {
      const key = duplicateRecipeKey(recipe);
      groups.set(key, [...(groups.get(key) || []), recipe]);
    });
    const duplicateGroups = [...groups.values()].filter((items) => items.length > 1);
    const duplicateCount = duplicateGroups.reduce(
      (total, items) => total + items.length - 1,
      0,
    );
    if (!duplicateCount)
      return Alert.alert("没有重复菜谱", "目前没有发现内容完全相同的菜谱。 ");
    setSheet({
      title: "清理重复菜谱？",
      subtitle: `将移除 ${duplicateCount} 道内容完全相同的重复菜谱，每组保留一份。`,
      options: [
        {
          label: "确认清理",
          destructive: true,
          action: async () => {
            if (!familyId) return;
            const duplicateIds: RecipeId[] = [];
            for (const items of duplicateGroups) {
              const [keep, ...duplicates] = items.sort(
                (a, b) =>
                  new Date(a.updatedAt || 0).getTime() -
                  new Date(b.updatedAt || 0).getTime(),
              );
              const menuSource = duplicates.find((item) => menu[String(item.id)]);
              if (!menu[String(keep.id)] && menuSource)
                await supabase.from("menu_items").upsert({
                  recipe_id: keep.id,
                  family_id: familyId,
                  stage: menu[String(menuSource.id)],
                  note: menuNotes[String(menuSource.id)] || "",
                  updated_at: new Date().toISOString(),
                });
              duplicateIds.push(...duplicates.map((item) => item.id));
            }
            const { error } = await supabase
              .from("recipes")
              .delete()
              .in("id", duplicateIds);
            if (error) return Alert.alert("清理失败", error.message);
            setRecipeList((items) =>
              items.filter((item) => !duplicateIds.includes(item.id)),
            );
            setMenu((items) =>
              Object.fromEntries(
                Object.entries(items).filter(([id]) => !duplicateIds.includes(id)),
              ) as Record<string, MenuStage>,
            );
            setMenuNotes((items) =>
              Object.fromEntries(
                Object.entries(items).filter(([id]) => !duplicateIds.includes(id)),
              ),
            );
            setFavorites((items) =>
              items.filter((id) => !duplicateIds.includes(id)),
            );
            Alert.alert("清理完成", `已移除 ${duplicateCount} 道重复菜谱。`);
          },
        },
      ],
    });
  };
  useEffect(() => {
    // Family sync must never wait for an old, potentially very large cache
    // (older versions could store photo data there). Load it opportunistically.
    setReady(true);
    void AsyncStorage.getItem("lico-preferences")
      .then((savedPreferences) => {
        if (!savedPreferences) return;
        const data = JSON.parse(savedPreferences);
        setNotificationsEnabled(data.notificationsEnabled ?? true);
        setDark(data.dark ?? false);
      })
      .catch(() => undefined);
    void AsyncStorage.getItem("lico-state")
      .then((savedLegacy) => {
        if (!savedLegacy) return;
        legacyStateRef.current = JSON.parse(savedLegacy);
        setLegacyRecipeCount(legacyStateRef.current.recipeList?.length || 0);
      })
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    if (ready)
      AsyncStorage.setItem(
        "lico-preferences",
        JSON.stringify({
          notificationsEnabled,
          dark,
        }),
      );
  }, [ready, notificationsEnabled, dark]);
  useEffect(() => {
    if (!familyId) {
      setFamilyCacheReady(false);
      return;
    }
    let active = true;
    legacyRecoveryPrompted.current = false;
    setFamilyCacheReady(false);
    AsyncStorage.getItem(`lico-family-state:${familyId}`)
      .then((saved) => {
        if (!active) return;
        if (saved) {
          const data = JSON.parse(saved);
          setRecipeList(data.recipeList || []);
          setMenu(data.menu || {});
          setMenuNotes(data.menuNotes || {});
          setFavorites(data.favorites || []);
          setChecked(data.checked || []);
        } else {
          setRecipeList([]);
          setMenu({});
          setMenuNotes({});
          setFavorites([]);
          setChecked([]);
        }
        setFamilyCacheReady(true);
      })
      .catch(() => {
        if (!active) return;
        setRecipeList([]);
        setMenu({});
        setMenuNotes({});
        setFavorites([]);
        setChecked([]);
        setFamilyCacheReady(true);
      });
    return () => {
      active = false;
    };
  }, [familyId]);
  useEffect(() => {
    if (!familyId || !familyCacheReady) return;
    AsyncStorage.setItem(
      `lico-family-state:${familyId}`,
      JSON.stringify({ recipeList, menu, menuNotes, favorites, checked }),
    );
  }, [familyId, familyCacheReady, recipeList, menu, menuNotes, favorites, checked]);
  useEffect(() => {
    if (!familyId) return setRecentRecipeIds([]);
    AsyncStorage.getItem(`lico-recent-recipes:${familyId}`)
      .then((saved) => setRecentRecipeIds(saved ? JSON.parse(saved) : []))
      .catch(() => setRecentRecipeIds([]));
  }, [familyId]);
  useEffect(() => {
    if (!composer || editingId || !familyId || restoredDraftFamily.current === familyId)
      return;
    let active = true;
    AsyncStorage.getItem(`lico-recipe-draft:${familyId}`)
      .then((saved) => {
        if (!active || !saved) return;
        const recovered = JSON.parse(saved);
        if (recovered?.name || recovered?.ingredients?.some((item: IngredientDraft) => item.name)) {
          setDraft({ ...createEmptyDraft(), ...recovered });
          Alert.alert("已恢复草稿", "继续把这道菜收进栗刻吧。 ");
        }
      })
      .catch(() => undefined)
      .finally(() => {
        restoredDraftFamily.current = familyId;
      });
    return () => {
      active = false;
    };
  }, [composer, editingId, familyId]);
  useEffect(() => {
    if (!composer || editingId || !familyId) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(`lico-recipe-draft:${familyId}`, JSON.stringify(draft)).catch(
        () => undefined,
      );
    }, 700);
    return () => clearTimeout(timer);
  }, [composer, editingId, familyId, draft]);
  useEffect(() => {
    Notifications.getPermissionsAsync()
      .then((permission) =>
        setNotificationPermission(
          permission.ios?.status ===
            Notifications.IosAuthorizationStatus.AUTHORIZED ||
            permission.ios?.status ===
              Notifications.IosAuthorizationStatus.PROVISIONAL
            ? "已允许"
            : permission.ios?.status ===
                Notifications.IosAuthorizationStatus.NOT_DETERMINED
              ? "未询问"
              : "未允许",
        ),
      )
      .catch(() => setNotificationPermission("未允许"));
  }, []);
  useEffect(() => {
    if (!familyId || !ready || !familyCacheReady || !session) return;
    let active = true;
    const loadFamilyData = async (force = false, retryCount = 0) => {
      if (syncedFamilyId.current !== familyId) {
        syncedFamilyId.current = familyId;
        familySyncSucceeded.current = false;
        remoteRecipeSnapshot.current = "";
      }
      if (!force && Date.now() < familySyncPausedUntil.current) return;
      if (familySyncLock.current) {
        familySyncQueued.current = true;
        return;
      }
      familySyncLock.current = true;
      const run = ++familySyncRun.current;
      let syncCompleted = false;
      let syncExpired = false;
      const watchdog = setTimeout(() => {
        if (!active || syncCompleted || familySyncRun.current !== run) return;
        syncExpired = true;
        familySyncLock.current = false;
        familySyncQueued.current = false;
        setSyncStatus("同步超时，点这里重试");
        setAuthMessage("家庭数据读取超过 15 秒，请检查网络后重试。");
      }, 15000);
      // Realtime can emit several events for one database write. Keep the last
      // confirmed state visible during those background refreshes instead of
      // leaving a family member stuck on a permanent “syncing” label.
      if (!familySyncSucceeded.current) setSyncStatus("正在同步…");
      try {
      const familyFilter = encodeURIComponent(familyId);
      const initialRecipes = await readFamilyRows<any[]>(
        `recipes?select=*&family_id=eq.${familyFilter}&order=updated_at.desc`,
        session.access_token,
        "读取菜谱超时，请检查网络后重试。",
      );
      if (syncExpired || familySyncRun.current !== run) return;
      const rows = initialRecipes || [];
      const nextSnapshot = rows
        .map((item: any) => `${item.id}:${item.updated_at || item.created_at || ""}`)
        .sort()
        .join("|");
      const remoteRecipesChanged =
        !!remoteRecipeSnapshot.current &&
        remoteRecipeSnapshot.current !== nextSnapshot;
      if (remoteRecipesChanged) setSyncStatus("正在同步…");
      const legacy = legacyStateRef.current;
      if (
        !rows.length &&
        legacy?.recipeList?.length &&
        !legacyRecoveryPrompted.current &&
        !(await AsyncStorage.getItem(`lico-legacy-restored:${familyId}`))
      ) {
        legacyRecoveryPrompted.current = true;
        setSyncStatus("发现旧菜谱，等待恢复");
        void offerLegacyRecovery();
        return;
      }
      const [
        remoteMenu,
        remoteChecks,
        remoteFavorites,
      ] = await Promise.all([
        readFamilyRows<any[]>(
          `menu_items?select=recipe_id%2Cstage%2Cnote&family_id=eq.${familyFilter}`,
          session.access_token,
          "读取菜单超时，请检查网络后重试。",
        ),
        readFamilyRows<any[]>(
          `shopping_checks?select=ingredient_key&family_id=eq.${familyFilter}&checked=eq.true`,
          session.access_token,
          "读取采购清单超时，请检查网络后重试。",
        ),
        readFamilyRows<any[]>(
          `recipe_favorites?select=recipe_id&family_id=eq.${familyFilter}`,
          session.access_token,
          "读取收藏超时，请检查网络后重试。",
        ),
      ]);
      if (syncExpired || familySyncRun.current !== run) return;
      const hydrated = rows.map((row: any) => {
          const [emoji, color] = recipeStyle(row.category);
          const steps = (row.steps || []).map((step: RecipeStep | string) =>
            typeof step === "string" ? { text: step } : { ...step },
          );
          return {
            id: row.id,
            name: row.name,
            category: row.category,
            taste: row.taste || "家常",
            time: row.cook_time || "待定",
            difficulty: row.difficulty || "简单",
            emoji,
            color,
            tags: row.tags || [],
            ingredients: row.ingredients || [],
            steps,
            cover: undefined,
            coverPath: row.cover_url || undefined,
            note: row.note || "",
            cookedCount: row.cooked_count || 0,
            lastCookedAt: row.last_cooked_at || undefined,
            updatedAt: row.updated_at || row.created_at,
            reviews: row.reviews || [],
          };
        });
      if (!active) return;
      setRecipeList(hydrated);
      setMenu(
        Object.fromEntries(
          remoteMenu.map((item: any) => [item.recipe_id, item.stage]),
        ) as Record<string, MenuStage>,
      );
      setMenuNotes(
        Object.fromEntries(
          remoteMenu.map((item: any) => [
            item.recipe_id,
            item.note || "",
          ]),
        ),
      );
      // A fetch that started before a local tap can return the old value after
      // the optimistic UI update. Keep that local choice until this response
      // (or a later realtime response) confirms it.
      const mergedChecks = new Set(
        remoteChecks.map((item: any) => item.ingredient_key),
      );
      const now = Date.now();
      Object.entries(pendingShoppingChecks.current).forEach(
        ([key, pending]) => {
          if (pending.expiresAt <= now) {
            delete pendingShoppingChecks.current[key];
          } else if (mergedChecks.has(key) === pending.checked) {
            delete pendingShoppingChecks.current[key];
          } else if (pending.checked) {
            mergedChecks.add(key);
          } else {
            mergedChecks.delete(key);
          }
        },
      );
      setChecked([...mergedChecks]);
      setFavorites(remoteFavorites.map((item: any) => item.recipe_id));
      setSyncStatus("已与家庭同步");
      remoteRecipeSnapshot.current = nextSnapshot;
      familySyncSucceeded.current = true;
      syncCompleted = true;
      void Promise.all(
        hydrated.map(async (recipe) => ({
          id: recipe.id,
          cover: await imageUrl(recipe.coverPath),
          steps: await Promise.all(
            recipe.steps.map(async (step: RecipeStep) => ({
              ...step,
              image: await imageUrl(step.imagePath || step.image),
            })),
          ),
        })),
      ).then((images) => {
        if (!active) return;
        const byId = new Map(images.map((item) => [String(item.id), item]));
        setRecipeList((items) =>
          items.map((recipe) => {
            const image = byId.get(String(recipe.id));
            return image ? { ...recipe, ...image } : recipe;
          }),
        );
      }).catch(() => undefined);
      } catch (error: any) {
        if (active) {
          const message = error?.message || "未知错误";
          if (retryCount < 2) {
            setTimeout(
              () => void loadFamilyData(true, retryCount + 1),
              1000 * (retryCount + 1),
            );
            return;
          }
          familySyncPausedUntil.current = Date.now() + 30000;
          setSyncStatus(
            String(error?.message || "").includes("超时")
              ? "同步超时，点这里重试"
              : "同步失败，点这里重试",
          );
          setAuthMessage(error?.message || "同步时发生错误，请重试。 ");
        }
      } finally {
        clearTimeout(watchdog);
        if (familySyncRun.current === run) {
          familySyncLock.current = false;
          if (familySyncQueued.current && syncCompleted) {
            familySyncQueued.current = false;
            void loadFamilyData();
          } else if (!syncCompleted) {
            familySyncQueued.current = false;
          }
        }
      }
    };
    void loadFamilyData(true);
    const channel = supabase
      .channel(`family-${familyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipes",
          filter: `family_id=eq.${familyId}`,
        },
        () => void loadFamilyData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "menu_items",
          filter: `family_id=eq.${familyId}`,
        },
        () => void loadFamilyData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "shopping_checks",
          filter: `family_id=eq.${familyId}`,
        },
        () => void loadFamilyData(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recipe_favorites",
          filter: `family_id=eq.${familyId}`,
        },
        () => void loadFamilyData(),
      )
      .subscribe();
    // Realtime handles the usual case. A five-second check is a small, reliable
    // fallback when a device briefly misses a realtime message.
    const retryTimer = setInterval(() => void loadFamilyData(), 5000);
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      familySyncPausedUntil.current = 0;
      void loadFamilyData(true);
    });
    return () => {
      active = false;
      clearInterval(retryTimer);
      appStateSubscription.remove();
      supabase.removeChannel(channel);
    };
  }, [familyId, ready, familyCacheReady, session, syncAttempt]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(
      () =>
        setSeconds((value) => {
          if (value <= 1) {
            clearInterval(id);
            setRunning(false);
            setTimerFinished(true);
            Alert.alert("Chestnut 提醒你", "计时结束，可以去看看锅里啦！");
            return 0;
          }
          return value - 1;
        }),
      1000,
    );
    return () => clearInterval(id);
  }, [running]);
  useEffect(() => {
    if (running || !timerNotificationRef.current) return;
    Notifications.cancelScheduledNotificationAsync(
      timerNotificationRef.current,
    ).catch(() => undefined);
    timerNotificationRef.current = null;
  }, [running]);
  useEffect(() => {
    setCookCountText(detail ? String(detail.cookedCount || 0) : "");
    setCookCountEditing(false);
    setCookCountStatus("");
  }, [detail?.id]);
  const tone = dark ? darkTheme : lightTheme;
  const recipeScreenTranslateX = useRef(new Animated.Value(0)).current;
  const recipeScreenSwipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.x0 <= 32 &&
          gesture.dx > 20 &&
          gesture.dx > Math.abs(gesture.dy) * 1.6,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          gesture.x0 <= 32 &&
          gesture.dx > 20 &&
          gesture.dx > Math.abs(gesture.dy) * 1.6,
        onPanResponderGrant: () => recipeScreenTranslateX.setValue(0),
        onPanResponderMove: (_, gesture) =>
          recipeScreenTranslateX.setValue(Math.max(0, gesture.dx)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 55 || (gesture.dx > 42 && gesture.vx > 0.75))
            return recipeScreenTranslateX.stopAnimation(() => {
              recipeScreenTranslateX.setValue(0);
              if (composer) setComposer(false);
              else if (settingsOpen) setSettingsOpen(false);
              else setDetail(null);
            });
          recipeScreenTranslateX.setValue(0);
        },
        onShouldBlockNativeResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => recipeScreenTranslateX.setValue(0),
      }),
    [composer, settingsOpen, recipeScreenTranslateX],
  );
  useEffect(() => {
    if (detail || composer || settingsOpen) return;
    recipeScreenTranslateX.stopAnimation();
    recipeScreenTranslateX.setValue(0);
  }, [detail, composer, settingsOpen, recipeScreenTranslateX]);
  const visibleRecipes = recipeList.filter(
    (recipe) =>
      (category === "全部" || recipe.category === category) &&
      (!favoritesOnly || favorites.includes(recipe.id)) &&
      recipe.name.includes(query.trim()) &&
      (!ingredientFilter.trim() ||
        recipe.ingredients.some((item) =>
          ingredientText(item).includes(ingredientFilter.trim()),
        )) &&
      (!tasteFilter.trim() || recipe.taste.includes(tasteFilter.trim())) &&
      (!tagFilter.trim() ||
        recipe.tags.some((tag) =>
          tag.toLowerCase().includes(tagFilter.trim().toLowerCase()),
        )),
  );
  const recentRecipes = recentRecipeIds
    .map((id) => recipeList.find((recipe) => String(recipe.id) === id))
    .filter(Boolean) as Recipe[];
  const openRecipe = (recipe: Recipe) => {
    if (familyId) {
      const next = [String(recipe.id), ...recentRecipeIds.filter((id) => id !== String(recipe.id))].slice(0, 6);
      setRecentRecipeIds(next);
      AsyncStorage.setItem(`lico-recent-recipes:${familyId}`, JSON.stringify(next)).catch(
        () => undefined,
      );
    }
    setDetail(recipe);
  };
  const familyTags = useMemo(
    () => [...new Set(recipeList.flatMap((recipe) => recipe.tags))].sort((a, b) => a.localeCompare(b, "zh-CN")),
    [recipeList],
  );
  const orderedVisibleRecipes = [...visibleRecipes].sort((a, b) =>
    sortMode === "做过最多"
      ? (b.cookedCount || 0) - (a.cookedCount || 0)
      : sortMode === "最近做过"
        ? new Date(b.lastCookedAt || 0).getTime() -
          new Date(a.lastCookedAt || 0).getTime()
        : new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
  );
  const shopping = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        unit: string;
        quantity: number | null;
        from: string[];
        type: string;
      }
    >();
    recipeList
      .filter(
        (recipe) =>
          shoppingStages.includes(menu[recipe.id]) &&
          menu[recipe.id] !== "已完成" &&
          !checked.includes(recipePurchaseKey(recipe.id)),
      )
      .forEach((recipe) =>
        recipe.ingredients.forEach((raw) => {
          const { name, unit, quantity, key } = shoppingIngredient(raw);
          const current = groups.get(key) || {
            key,
            name,
            unit,
            quantity: 0,
            from: [],
            type: ingredientType(raw),
          };
          current.quantity =
            current.quantity === null || quantity === null
              ? null
              : current.quantity + quantity;
          current.from.push(recipe.name);
          groups.set(key, current);
        }),
      );
    return [...groups.values()].map((item) => ({
      key: item.key,
      ingredient: `${item.name}${item.quantity === null ? "" : ` ${item.quantity}`}${item.unit}`,
      from: [...new Set(item.from)].join("、"),
      type: item.type || "其他",
    }));
  }, [checked, menu, recipeList, shoppingStages]);
  const shoppingGroups = useMemo(() => {
    return shopping.reduce<Record<string, typeof shopping>>((groups, item) => {
      const key = item.type;
      (groups[key] ||= []).push(item);
      return groups;
    }, {});
  }, [shopping]);
  const shoppingRecipes = recipeList.filter(
    (recipe) =>
      shoppingStages.includes(menu[recipe.id]) && menu[recipe.id] !== "已完成",
  );
  const unpurchasedShoppingRecipes = shoppingRecipes.filter(
    (recipe) => !checked.includes(recipePurchaseKey(recipe.id)),
  );
  const shoppingRecipeCount = shoppingRecipes.length;
  const shoppingComplete =
    shoppingRecipeCount > 0 &&
    (!unpurchasedShoppingRecipes.length ||
      (shopping.length > 0 && shopping.every((item) => checked.includes(item.key))));
  const remainingShoppingCount = shopping.filter(
    (item) => !checked.includes(item.key),
  ).length;
  const menuStageCounts = useMemo(
    () =>
      Object.fromEntries(
        stages.map((item) => [
          item,
          recipeList.filter((recipe) => menu[recipe.id] === item).length,
        ]),
      ) as Record<MenuStage, number>,
    [menu, recipeList],
  );
  const totalCookedCount = recipeList.reduce(
    (total, recipe) => total + (recipe.cookedCount || 0),
    0,
  );
  const activeMenuCount = recipeList.filter(
    (recipe) => menu[recipe.id] && menu[recipe.id] !== "已完成",
  ).length;
  const chestnutNote = !recipeList.length
    ? "先收进第一道拿手菜吧，Chestnut 会替你看着。"
    : activeMenuCount
      ? `菜单里还有 ${activeMenuCount} 道菜等着开火，今天吃点好的。`
      : "今晚要不要从菜谱本里挑一道，给小厨房开个张？";
  const setMenuStage = async (id: RecipeId, next: MenuStage) => {
    if (!familyId) return;
    setMenu((current) => ({ ...current, [String(id)]: next }));
    const { error } = await supabase.from("menu_items").upsert({
      recipe_id: id,
      family_id: familyId,
      stage: next,
      updated_at: new Date().toISOString(),
    });
    if (error) Alert.alert("菜单没有同步成功", error.message);
  };
  const saveMenuNote = async (id: RecipeId) => {
    if (!familyId) return;
    const note = menuNoteText.trim();
    const { error } = await supabase
      .from("menu_items")
      .update({ note, updated_at: new Date().toISOString() })
      .eq("family_id", familyId)
      .eq("recipe_id", id);
    if (error) return Alert.alert("便签保存失败", error.message);
    setMenuNotes((notes) => ({ ...notes, [String(id)]: note }));
    setMenuNoteId(null);
  };
  const moveRecipe = (id: RecipeId) =>
    setSheet({
      title: "加入或移动到菜单",
      subtitle: recipeList.find((item) => item.id === id)?.name,
      options: stages.map((next) => ({
        label: next,
        action: () => setMenuStage(id, next),
      })),
    });
  const removeFromMenu = (id: RecipeId) =>
    setSheet({
      title: "从菜单移除？",
      subtitle: recipeList.find((item) => item.id === id)?.name,
      options: [
        {
          label: "确认移除",
          destructive: true,
          action: async () => {
            if (!familyId) return;
            const { error } = await supabase
              .from("menu_items")
              .delete()
              .eq("recipe_id", id);
            if (error) return Alert.alert("移除失败", error.message);
            setMenu((current) => {
              const { [String(id)]: _, ...rest } = current;
              return rest;
            });
            setMenuNotes((notes) => {
              const { [String(id)]: _, ...rest } = notes;
              return rest;
            });
          },
        },
      ],
    });
  const updateShoppingCheck = async (key: string, next: boolean) => {
    if (!familyId) return false;
    pendingShoppingChecks.current[key] = {
      checked: next,
      expiresAt: Date.now() + 5000,
    };
    setChecked((items) =>
      next
        ? [...new Set([...items, key])]
        : items.filter((item) => item !== key),
    );
    const { error } = await supabase.from("shopping_checks").upsert({
      family_id: familyId,
      ingredient_key: key,
      checked: next,
      updated_at: new Date().toISOString(),
    });
    if (!error) return true;

    delete pendingShoppingChecks.current[key];
    setChecked((items) =>
      next ? items.filter((item) => item !== key) : [...new Set([...items, key])],
    );
    Alert.alert("采购状态没有同步成功", error.message);
    return false;
  };
  const toggleCheck = async (ingredient: string) => {
    const now = Date.now();
    if (now - (shoppingCheckLock.current[ingredient] || 0) < 700) return;
    shoppingCheckLock.current[ingredient] = now;
    await updateShoppingCheck(ingredient, !checked.includes(ingredient));
  };
  const toggleRecipePurchased = async (recipe: Recipe) => {
    const key = recipePurchaseKey(recipe.id);
    const now = Date.now();
    if (now - (shoppingCheckLock.current[key] || 0) < 700) return;
    shoppingCheckLock.current[key] = now;
    await updateShoppingCheck(key, !checked.includes(key));
  };
  const clearPurchased = async () => {
    if (!familyId || !checked.length) return;
    const previousChecked = [...checked];
    const expiresAt = Date.now() + 5000;
    previousChecked.forEach((key) => {
      pendingShoppingChecks.current[key] = { checked: false, expiresAt };
    });
    setChecked([]);
    const { error } = await supabase
      .from("shopping_checks")
      .update({ checked: false, updated_at: new Date().toISOString() })
      .eq("family_id", familyId)
      .eq("checked", true);
    if (!error) return;
    previousChecked.forEach((key) => delete pendingShoppingChecks.current[key]);
    setChecked(previousChecked);
    Alert.alert("清除失败", error.message);
  };
  const toggleStage = (item: MenuStage) => {
    if (item === "已完成") return;
    setShoppingStages((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item],
    );
  };
  const toggleFavorite = async (recipeId: RecipeId) => {
    if (!familyId) return;
    const exists = favorites.includes(recipeId);
    setFavorites((items) =>
      exists ? items.filter((id) => id !== recipeId) : [...items, recipeId],
    );
    const request = exists
      ? supabase
          .from("recipe_favorites")
          .delete()
          .eq("family_id", familyId)
          .eq("recipe_id", recipeId)
      : supabase
          .from("recipe_favorites")
          .insert({ family_id: familyId, recipe_id: recipeId });
    const { error } = await request;
    if (error) {
      setFavorites((items) =>
        exists ? [...items, recipeId] : items.filter((id) => id !== recipeId),
      );
      Alert.alert("收藏没有同步成功", error.message);
    }
  };
  const updateNotificationPermission = async () => {
    const permission = await Notifications.requestPermissionsAsync();
    const allowed =
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.AUTHORIZED ||
      permission.ios?.status ===
        Notifications.IosAuthorizationStatus.PROVISIONAL;
    setNotificationPermission(allowed ? "已允许" : "未允许");
    setNotificationsEnabled(allowed);
    return allowed;
  };
  const testNotification = async () => {
    try {
      if (!(await updateNotificationPermission()))
        return Alert.alert(
          "还没有通知权限",
          "请在 iPhone 设置中允许「栗刻」发送通知后再试。",
        );
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Chestnut 的测试提醒 🐾",
          body: "通知设置已经准备好了。",
          sound: "default",
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: 3,
          repeats: false,
        },
      });
      Alert.alert("测试提醒已安排", "3 秒后会收到 Chestnut 的提醒。");
    } catch {
      Alert.alert("测试提醒没有发出", "请检查通知权限后重试。");
    }
  };
  const formattedTime = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const settleWebWheel = (part: "minutes" | "seconds", offsetY: number) => {
    if (running) return;
    if (webWheelSettleTimer.current) clearTimeout(webWheelSettleTimer.current);
    webWheelSettleTimer.current = setTimeout(() => {
      const rawValue = Math.round(offsetY / 42);
      const value = part === "minutes"
        ? Math.max(0, Math.min(180, rawValue))
        : Math.max(0, Math.min(179, rawValue));
      const targetOffset = value * 42;
      (part === "minutes" ? webMinuteWheelRef : webSecondWheelRef).current?.scrollTo({ y: targetOffset, animated: true });
      setTimerFinished(false);
      if (part === "minutes") {
        setSeconds((current) => value * 60 + (current % 60));
      } else {
        const secondValue = value % 60;
        setSecondWheelIndex(60 + secondValue);
        setSeconds((current) => Math.floor(current / 60) * 60 + secondValue);
      }
    }, 120);
  };
  const toggleTimer = async () => {
    if (running) return setRunning(false);
    if (!seconds) return Alert.alert("先设定时间", "滚动转轮设置至少 1 秒。");
    setTimerFinished(false);
    try {
      if (!notificationsEnabled) return setRunning(true);
      if (await updateNotificationPermission())
        timerNotificationRef.current =
          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Chestnut 的厨房提醒 🐾",
              body: "计时结束，可以去看看锅里啦！",
              sound: "default",
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds,
              repeats: false,
            },
          });
      setRunning(true);
    } catch {
      setRunning(true);
    }
  };
  const pickDinner = () => {
    const candidates = recipeList.filter(
      (recipe) => randomCategory === "全部" || recipe.category === randomCategory,
    );
    if (!candidates.length)
      return Alert.alert(
        "还没有可选菜谱",
        randomCategory === "全部"
          ? "还没有可随机选择的菜谱。"
          : `还没有「${randomCategory}」分类的菜谱。`,
      );
    if (randomPicking) return;
    let turns = 0;
    setRandomPicking(true);
    randomTimerRef.current = setInterval(() => {
      const candidate =
        candidates[Math.floor(Math.random() * candidates.length)];
      setRandomName(candidate.name);
      turns += 1;
      if (turns === 14 && randomTimerRef.current) {
        clearInterval(randomTimerRef.current);
        randomTimerRef.current = null;
        setRandomPicking(false);
      }
    }, 85);
  };
  const saveRecipe = async () => {
    if (recipeSaveLock.current) return;
    const ingredients = draft.ingredients
      .filter((item) => item.name.trim())
      .map((item) => ({
        name: item.name.trim(),
        quantity: item.quantity.trim(),
        unit: item.unit,
        type: item.type || "其他",
      }));
    const steps: RecipeStep[] = draft.steps
      .map((item) => ({ ...item, text: item.text.trim() }))
      .filter((item) => item.text);
    const missing = [
      !draft.name.trim() && "菜名",
      !ingredients.length && "至少一种食材",
      !steps.length && "至少一个制作步骤",
    ].filter(Boolean);
    if (missing.length)
      return Alert.alert(
        "还差一点",
        `请填写：${missing.join("、")}。`,
      );
    if (!familyId || !session)
      return Alert.alert("还没有家庭", "请先完成登录并创建或加入家庭。");
    recipeSaveLock.current = true;
    setSavingRecipe(true);
    try {
      const mediaBase = `${familyId}/recipes/${editingId || Date.now()}`;
      const coverPath =
        (await uploadImage(draft.cover, `${mediaBase}/cover.jpg`)) ||
        draft.coverPath ||
        null;
      const savedSteps = await Promise.all(
        steps.map(async (item, index) => ({
          text: item.text,
          imagePath:
            (await uploadImage(
              item.image,
              `${mediaBase}/step-${index + 1}.jpg`,
            )) ||
            item.imagePath ||
            undefined,
        })),
      );
      const payload = {
        family_id: familyId,
        name: draft.name.trim(),
        category: draft.category,
        taste: draft.taste.trim() || "家常",
        cook_time: draft.time.trim() || "待定",
        difficulty: draft.difficulty,
        tags: draft.tags
          .split(/[，,]/)
          .map((item) => item.trim())
          .filter(Boolean),
        ingredients,
        steps: savedSteps,
        cover_url: coverPath,
        note: draft.note.trim() || "新收进栗刻的小菜谱。",
        updated_at: new Date().toISOString(),
      };
      const request = editingId
        ? supabase
            .from("recipes")
            .update(payload)
            .eq("id", editingId)
            .select()
            .single()
        : supabase
            .from("recipes")
            .insert({ ...payload, created_by: session.user.id })
            .select()
            .single();
      const { data, error } = await request;
      if (error || !data)
        return Alert.alert("保存失败", error?.message || "请稍后重试。");
      const [emoji, color] = recipeStyle(data.category);
      const recipe: Recipe = {
        id: data.id,
        name: data.name,
        category: data.category,
        taste: data.taste || "家常",
        time: data.cook_time || "待定",
        difficulty: data.difficulty || "简单",
        emoji,
        color,
        tags: data.tags || [],
        ingredients: data.ingredients || [],
        steps: await Promise.all(
          (data.steps || []).map(async (step: RecipeStep) => ({
            ...step,
            image: await imageUrl(step.imagePath),
          })),
        ),
        cover: await imageUrl(data.cover_url),
        coverPath: data.cover_url || undefined,
        note: data.note || "",
        cookedCount: data.cooked_count || 0,
        lastCookedAt: data.last_cooked_at || undefined,
        reviews: data.reviews || [],
      };
      setRecipeList((items) =>
        editingId
          ? items.map((item) => (item.id === editingId ? recipe : item))
          : [recipe, ...items],
      );
      setEditingId(null);
      setDraft(createEmptyDraft());
      await AsyncStorage.removeItem(`lico-recipe-draft:${familyId}`);
      setComposer(false);
      setDetail(recipe);
    } catch (error: any) {
      Alert.alert("图片上传失败", error.message || "请检查网络后重试。");
    } finally {
      recipeSaveLock.current = false;
      setSavingRecipe(false);
    }
  };
  const editRecipe = (recipe: Recipe) => {
    setEditingId(recipe.id);
    setDraft({
      name: recipe.name,
      category: recipe.category,
      taste: recipe.taste,
      time: recipe.time,
      difficulty: recipe.difficulty || "简单",
      tags: recipe.tags.join("，"),
      note: recipe.note,
      emoji: recipe.emoji,
      cover: recipe.cover,
      coverPath: recipe.coverPath,
      ingredients: recipe.ingredients.map((item) => {
        if (typeof item !== "string")
          return {
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            type: item.type || "其他",
          };
        const match = item.match(
          /^(.*?)\s*([\d.]+)?\s*(克|毫升|个|勺|把|适量)?$/,
        );
        return {
          name: match?.[1]?.trim() || item,
          quantity: match?.[2] || "",
          unit: match?.[3] || "克",
          type: "其他",
        };
      }),
      steps: recipe.steps.map((step: any) =>
        typeof step === "string" ? { text: step } : step,
      ),
    });
    setDetail(null);
    setComposer(true);
  };
  const duplicateRecipe = (recipe: Recipe) => {
    editRecipe(recipe);
    setEditingId(null);
    setDraft((current) => ({ ...current, name: `${recipe.name}（副本）` }));
  };
  const markCooked = async (recipe: Recipe) => {
    const cookedCount = (recipe.cookedCount || 0) + 1;
    const lastCookedAt = new Date().toISOString();
    const { error } = await supabase
      .from("recipes")
      .update({
        cooked_count: cookedCount,
        last_cooked_at: lastCookedAt,
        updated_at: lastCookedAt,
      })
      .eq("id", recipe.id);
    if (error) return Alert.alert("记录失败", error.message);
    const updated = { ...recipe, cookedCount, lastCookedAt };
    setCookCountText(String(cookedCount));
    setCookCountStatus("已记录并同步");
    setRecipeList((items) =>
      items.map((item) => (item.id === recipe.id ? updated : item)),
    );
    setDetail(updated);
  };
  const saveCookCount = async (recipe: Recipe) => {
    const cookedCount = Number(cookCountText);
    if (!Number.isInteger(cookedCount) || cookedCount < 0)
      return Alert.alert("次数不正确", "请输入 0 或更大的整数。");
    const { error } = await supabase
      .from("recipes")
      .update({
        cooked_count: cookedCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recipe.id);
    if (error) return Alert.alert("保存失败", error.message);
    const updated = { ...recipe, cookedCount };
    setCookCountEditing(false);
    setCookCountStatus("已同步");
    setRecipeList((items) =>
      items.map((item) => (item.id === recipe.id ? updated : item)),
    );
    setDetail(updated);
  };
  const leaveReview = async (recipe: Recipe) => {
    const text = reviewText.trim();
    if (!text) return;
    const reviews = [
      ...(recipe.reviews || []),
      {
        id: `${Date.now()}`,
        author_name: profile.display_name,
        text,
        created_at: new Date().toISOString(),
      },
    ];
    const { error } = await supabase
      .from("recipes")
      .update({ reviews, updated_at: new Date().toISOString() })
      .eq("id", recipe.id);
    if (error) return Alert.alert("评价保存失败", error.message);
    const updated = { ...recipe, reviews };
    setRecipeList((items) =>
      items.map((item) => (item.id === recipe.id ? updated : item)),
    );
    setDetail(updated);
    setReviewText("");
  };
  const deleteRecipe = (recipe: Recipe) =>
    setSheet({
      title: "删除这道菜谱？",
      subtitle:
        "菜谱、菜单中的对应项目和评价都会被移除，家庭成员也会同步看不到。",
      options: [
        {
          label: "确认删除",
          destructive: true,
          action: async () => {
            if (!familyId) return;
            await supabase
              .from("menu_items")
              .delete()
              .eq("family_id", familyId)
              .eq("recipe_id", recipe.id);
            const { error } = await supabase
              .from("recipes")
              .delete()
              .eq("id", recipe.id);
            if (error) return Alert.alert("删除失败", error.message);
            setRecipeList((items) =>
              items.filter((item) => item.id !== recipe.id),
            );
            setFavorites((items) => items.filter((id) => id !== recipe.id));
            setMenu((current) => {
              const { [String(recipe.id)]: _, ...rest } = current;
              return rest;
            });
            setDetail(null);
            setEditingId(null);
            setComposer(false);
            setDraft({
              name: "",
              category: "主菜",
              taste: "",
              time: "",
              difficulty: "简单",
              tags: "",
              note: "",
              emoji: "🍳",
              cover: undefined,
              coverPath: undefined,
              ingredients: [
                { name: "", quantity: "", unit: "克", type: "其他" },
              ],
              steps: [{ text: "" }],
            });
          },
        },
      ],
    });
  const chooseImage = async (setUri: (uri: string) => void) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return Alert.alert("需要相册权限", "请允许栗刻访问相册后再选择图片。");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const longestEdge = Math.max(asset.width || 0, asset.height || 0);
      const resized = await manipulateAsync(
        asset.uri,
        longestEdge > 1280
          ? [
              asset.width >= asset.height
                ? { resize: { width: 1280 } }
                : { resize: { height: 1280 } },
            ]
          : [],
        { compress: 0.68, format: SaveFormat.JPEG },
      );
      setUri(resized.uri);
    }
  };
  const sendCode = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setAuthMessage(error ? error.message : "验证码已发送，请查看邮箱。");
  };
  const verifyCode = async () => {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    setAuthMessage(error ? error.message : "登录成功。");
  };
  const createFamily = async () => {
    const { data, error } = await supabase.rpc("create_family", {
      family_name: familyName,
    });
    if (error) return setAuthMessage(error.message);
    setFamilyInviteCode(data.invite_code);
    setFamilyId(data.id);
  };
  const joinFamily = async () => {
    const { data, error } = await supabase.rpc("join_family", {
      code: inviteCode,
    });
    if (error) return setAuthMessage(error.message);
    setFamilyId(data.id);
  };
  const saveFamilyName = async () => {
    if (!familyId) return;
    const name = familyName.trim() || "我们的厨房";
    const { error } = await supabase
      .from("families")
      .update({ name })
      .eq("id", familyId);
    if (error) return Alert.alert("家庭名称保存失败", error.message);
    setFamilyName(name);
    setFamilyEditing(false);
  };
  const copyInviteCode = async () => {
    if (!familyInviteCode) return;
    await Clipboard.setStringAsync(familyInviteCode);
    Alert.alert("邀请码已复制", "发给要加入这个小厨房的人吧。最多可有 3 位成员。");
  };
  const retrySync = () => {
    familySyncPausedUntil.current = 0;
    setSyncStatus("正在同步…");
    setSyncAttempt((value) => value + 1);
  };
  const removeFamilyTag = (tag: string) =>
    setSheet({
      title: `删除「${tag}」？`,
      subtitle: "会从本家庭所有菜谱中移除这个标签，菜谱内容不受影响。",
      options: [{ label: "删除标签", destructive: true, action: async () => {
        if (!familyId) return;
        const affected = recipeList.filter((recipe) => recipe.tags.includes(tag));
        setRecipeList((items) => items.map((recipe) => recipe.tags.includes(tag) ? { ...recipe, tags: recipe.tags.filter((item) => item !== tag) } : recipe));
        const results = await Promise.all(affected.map((recipe) => supabase.from("recipes").update({ tags: recipe.tags.filter((item) => item !== tag), updated_at: new Date().toISOString() }).eq("id", recipe.id).eq("family_id", familyId)));
        if (results.some((result) => result.error)) {
          setSyncStatus("同步失败，点这里重试");
          Alert.alert("标签删除没有完全同步", "请稍后点同步重试。 ");
        }
      }}],
    });
  const signOut = () =>
    setSheet({
      title: "退出当前账号？",
      subtitle: "退出后可使用另一个邮箱登录或测试邀请码。",
      options: [
        {
          label: "确认退出",
          destructive: true,
          action: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) Alert.alert("退出失败", error.message);
          },
        },
      ],
    });
  const leaveFamily = () =>
    setSheet({
      title: "退出当前家庭？",
      subtitle:
        "退出后将不再看到这个家庭的菜谱与菜单，并回到创建或加入家庭的页面。",
      options: [
        {
          label: "确认退出家庭",
          destructive: true,
          action: async () => {
            const { error } = await supabase.rpc("leave_family");
            if (error) return Alert.alert("退出家庭失败", error.message);
            setFamilyId(null);
            setFamilyResolved(true);
            setTab("菜谱本");
            setDetail(null);
            setComposer(false);
            Alert.alert("已退出家庭", "现在可以创建或加入新的家庭。 ");
          },
        },
      ],
    });
  const removeMember = (userId: string) =>
    setSheet({
      title: "移出这位成员？",
      subtitle: "对方将无法再查看或编辑这个家庭的内容。",
      options: [
        {
          label: "确认移出",
          destructive: true,
          action: async () => {
            const { error } = await supabase.rpc("remove_family_member", {
              member_id: userId,
            });
            if (error) return Alert.alert("移出失败", error.message);
            setMembers((current) =>
              current.filter((member) => member.user_id !== userId),
            );
          },
        },
      ],
    });
  const Nav = () => (
    <View
      style={[
        styles.nav,
        {
          backgroundColor: dark ? "#2C211DF0" : "#FFF9F0E8",
          borderColor: tone.line,
        },
      ]}
    >
      {(["菜谱本", "菜单", "计时器", "我的"] as const).map((item, index) => (
        <Pressable
          key={item}
          onPress={() => {
            setTab(item);
            setDetail(null);
            setSettingsOpen(false);
          }}
          style={styles.navItem}
        >
          <View
            style={[
              styles.navDoodle,
              tab === item && { backgroundColor: tone.accent },
              { transform: [{ rotate: `${[-2, 1, -1, 2][index]}deg` }] },
            ]}
          >
            <Image
              source={navArt[item]}
              style={[styles.navImage, { opacity: tab === item ? 1 : 0.55 }]}
              resizeMode="contain"
            />
          </View>
          <Text
            style={[
              styles.navText,
              { color: tab === item ? tone.orange : tone.muted },
            ]}
          >
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );
  const RecipeCard = ({ recipe }: { recipe: Recipe }) => (
    <Pressable
      onPress={() => openRecipe(recipe)}
      style={[styles.recipeCard, { backgroundColor: tone.card }]}
    >
      <View style={[styles.foodCircle, { backgroundColor: recipe.color }]}>
        {recipe.cover ? (
          <Image source={{ uri: recipe.cover }} style={styles.cardCover} />
        ) : (
          <Text style={styles.foodEmoji}>{recipe.emoji}</Text>
        )}
      </View>
      <View style={styles.recipeInfo}>
        <Text style={[styles.recipeName, { color: tone.ink }]}>
          {recipe.name}
        </Text>
        <Text style={[styles.recipeMeta, { color: tone.muted }]}>
          {recipe.category} · {recipe.taste} · {recipe.difficulty} · {recipe.time}
        </Text>
        <Text style={[styles.recipeCooked, { color: tone.orange }]}> 
          🍳 做过 {recipe.cookedCount || 0} 次
          {recipe.lastCookedAt
            ? ` · 上次 ${new Date(recipe.lastCookedAt).toLocaleDateString("zh-CN")}`
            : " · 还没做过"}
        </Text>
        <View style={styles.tags}>
          {recipe.tags.map((tag, index) => (
            <Pressable
              key={tag}
              onPress={() => setTagFilter(tag)}
              style={[
                styles.tagSticker,
                { transform: [{ rotate: `${index % 2 ? -2 : 1}deg` }] },
              ]}
            >
              <View
                style={[
                  styles.tagPin,
                  {
                    backgroundColor:
                      index % 3 === 0
                        ? "#C86D42"
                        : index % 3 === 1
                          ? "#8AA07D"
                          : "#D8A34B",
                  },
                ]}
              />
              <Text
                style={[
                  styles.tag,
                  {
                    backgroundColor: [
                      "#FFF1C9",
                      "#F8D9D3",
                      "#DDE9D4",
                      "#D9E7F5",
                    ][index % 4],
                    color: dark ? "#49382D" : tone.ink,
                    borderWidth: tagFilter === tag ? 1 : 0,
                    borderColor: tone.orange,
                  },
                ]}
              >
                {tag}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          onPress={() => moveRecipe(recipe.id)}
          style={[styles.cardMenu, { backgroundColor: tone.accent }]}
        >
          <Text style={{ color: tone.orange, fontWeight: "800" }}>＋ 菜单</Text>
        </Pressable>
        <Pressable onPress={() => editRecipe(recipe)}>
          <Text style={[styles.cardEdit, { color: tone.muted }]}>编辑菜谱</Text>
        </Pressable>
        <Pressable onPress={() => toggleFavorite(recipe.id)}>
          <Text
            style={[
              styles.favorite,
              {
                color: favorites.includes(recipe.id) ? tone.orange : tone.muted,
              },
            ]}
          >
            {favorites.includes(recipe.id) ? "♥" : "♡"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
  const Recipes = () => (
    <View style={styles.recipeScreen}>
      <ScrollView
        stickyHeaderIndices={[1]}
        contentContainerStyle={styles.recipeScrollContent}
        refreshControl={
          <RefreshControl
            refreshing={syncStatus === "正在同步…"}
            onRefresh={retrySync}
            tintColor={tone.orange}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
      <View style={styles.recipeIntro}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: tone.orange }]}>
            A LITTLE KITCHEN DIARY
          </Text>
          <Text style={[styles.title, { color: tone.ink }]}>
            栗刻 <Text style={styles.lico}>LICO</Text>
          </Text>
        </View>
        <Pressable
          onPress={() => setComposer(true)}
          style={[styles.addButton, { backgroundColor: tone.orange }]}
        >
          <Text style={styles.addText}>＋ 录入</Text>
        </Pressable>
      </View>
      <View style={[styles.welcome, { backgroundColor: tone.accent }]}>
        <View>
          <Text style={[styles.welcomeSmall, { color: tone.orange }]}>
            晚上好，Eric & 她
          </Text>
          <Text style={[styles.welcomeTitle, { color: tone.ink }]}>
            Chestnut 说，{`\n`}今天吃点好的吧！
          </Text>
          <View style={styles.randomControls}>
            <Pressable
              onPress={pickDinner}
              style={[styles.spinButton, { backgroundColor: tone.orange }]}
            >
              <Text style={styles.spinText}>
                {randomPicking ? "✦ Chestnut 转转中…" : "✦ 随机菜品"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "选一个菜品类别",
                  undefined,
                  categories.map((item) => ({
                    text: item,
                    onPress: () => setRandomCategory(item),
                  })),
                )
              }
              style={[styles.randomTag, { backgroundColor: tone.card }]}
            >
              <Text style={{ color: tone.orange, fontWeight: "800" }}>
                {randomCategory}⌄
              </Text>
            </Pressable>
          </View>
          {randomName ? (
            <Text style={[styles.randomResult, { color: tone.ink }]}>
              {randomPicking
                ? "转到「" + randomName + "」…"
                : "今晚就做「" + randomName + "」！"}
            </Text>
          ) : null}
        </View>
        <Image
          source={chestnutMascot}
          style={styles.chestnutHero}
          resizeMode="contain"
        />
      </View>
      {recentRecipes.length ? (
        <View style={styles.recentSection}>
          <Text style={[styles.recentTitle, { color: tone.ink }]}>最近翻过的菜谱</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
            {recentRecipes.map((recipe) => (
              <Pressable
                key={recipe.id}
                onPress={() => openRecipe(recipe)}
                style={[styles.recentCard, { backgroundColor: tone.card, borderColor: tone.line }]}
              >
                <Text style={styles.recentEmoji}>{recipe.emoji}</Text>
                <Text numberOfLines={1} style={[styles.recentName, { color: tone.ink }]}>{recipe.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      </View>
      <View style={[styles.recipeStickyFilters, { backgroundColor: tone.paper }]}> 
      <View
        style={[
          styles.search,
          { backgroundColor: tone.card, borderColor: tone.line },
        ]}
      >
        <Text style={{ color: tone.muted }}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索菜品名字"
          placeholderTextColor={tone.muted}
          style={[styles.input, { color: tone.ink }]}
        />
      </View>
      {tagFilter ? (
        <Pressable
          onPress={() => setTagFilter("")}
          style={[styles.activeTagFilter, { backgroundColor: tone.accent }]}
        >
          <Text style={{ color: tone.orange, fontWeight: "800" }}>
            🏷 {tagFilter} ×
          </Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => setFiltersOpen((value) => !value)}
        style={[
          styles.filterToggle,
          { backgroundColor: filtersOpen ? tone.orange : tone.accent },
        ]}
      >
        <Text
          style={{
            color: filtersOpen ? "#fffaf0" : tone.orange,
            fontWeight: "800",
          }}
        >
          ⌘ 食材 / 口味筛选 {filtersOpen ? "收起" : "展开"}
        </Text>
      </Pressable>
      {filtersOpen && (
        <View style={[styles.filterPanel, { backgroundColor: tone.card }]}>
          <TextInput
            value={ingredientFilter}
            onChangeText={setIngredientFilter}
            placeholder="食材，例如：牛肉"
            placeholderTextColor={tone.muted}
            style={[
              styles.filterInput,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
          <TextInput
            value={tasteFilter}
            onChangeText={setTasteFilter}
            placeholder="口味，例如：微辣"
            placeholderTextColor={tone.muted}
            style={[
              styles.filterInput,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
          <TextInput
            value={tagFilter}
            onChangeText={setTagFilter}
            placeholder="标签，例如：约会"
            placeholderTextColor={tone.muted}
            style={[
              styles.filterInput,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
          <Pressable
            onPress={() => {
              setIngredientFilter("");
              setTasteFilter("");
              setTagFilter("");
            }}
          >
            <Text
              style={{
                color: tone.muted,
                fontWeight: "700",
                textAlign: "right",
              }}
            >
              清除筛选
            </Text>
          </Pressable>
          <Text style={[styles.tagLibraryTitle, { color: tone.ink }]}>全家标签收纳盒</Text>
          <View style={styles.tagLibrary}>{familyTags.length ? familyTags.map((tag, index) => <View key={tag} style={[styles.libraryTag, { backgroundColor: ['#FFF1C9', '#F8D9D3', '#DDE9D4', '#D9E7F5'][index % 4] }]}><Pressable onPress={() => setTagFilter(tag)}><Text style={{ color: tone.ink, fontSize: 12 }}>{tag}</Text></Pressable><Pressable onPress={() => removeFamilyTag(tag)} hitSlop={7}><Text style={{ color: tone.muted, marginLeft: 5 }}>×</Text></Pressable></View>) : <Text style={{ color: tone.muted, fontSize: 12 }}>先在菜谱编辑页添加标签吧。</Text>}</View>
        </View>
      )}
      <View style={styles.categoryScroller}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.map((item, index) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[
                styles.category,
                {
                  backgroundColor: category === item ? tone.orange : tone.card,
                },
                { transform: [{ rotate: `${index % 2 ? -0.5 : 0.6}deg` }] },
              ]}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: category === item ? "#fffaf0" : tone.ink },
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.categoryScrollHint}>
          <View
            style={[
              styles.categoryScrollThumb,
              { backgroundColor: tone.orange },
            ]}
          />
          <Text style={[styles.categoryScrollText, { color: tone.muted }]}>
            滑动查看更多
          </Text>
        </View>
      </View>
      </View>
      <View style={styles.recipeListContent}>
      <View style={styles.sectionHead}>
        <View>
          <Text style={[styles.sectionTitle, { color: tone.ink }]}>
            {favoritesOnly
              ? "收藏菜谱"
              : category === "全部"
                ? "菜谱本"
                : category}
          </Text>
          <Pressable onPress={retrySync} hitSlop={8}>
            <Text style={[styles.syncText, { color: syncStatus.includes("同步") ? tone.orange : tone.muted }]}>
              {syncStatus.includes("正在") ? syncStatus : `↻ ${syncStatus}`}
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => setFavoritesOnly((value) => !value)}
          style={[
            styles.favoriteFilter,
            { backgroundColor: favoritesOnly ? tone.orange : tone.accent },
          ]}
        >
          <Text
            style={{
              color: favoritesOnly ? "#fffaf0" : tone.orange,
              fontWeight: "800",
            }}
          >
            {favoritesOnly ? "♥ 只看收藏" : "♡ 收藏 " + favorites.length}
          </Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() =>
          Alert.alert(
            "菜谱排序",
            undefined,
            ["最近添加", "最近做过", "做过最多"].map((item) => ({
              text: item,
              onPress: () => setSortMode(item as typeof sortMode),
            })),
          )
        }
        style={[styles.sortButton, { backgroundColor: tone.accent }]}
      >
        <Text style={{ color: tone.orange, fontWeight: "800" }}>
          ↕ {sortMode}
        </Text>
      </Pressable>
      {favoritesOnly && !visibleRecipes.length ? (
        <Text style={[styles.emptyFavorite, { color: tone.muted }]}>
          还没有收藏，点菜谱卡片右下角的 ♡ 收进这里吧。
        </Text>
      ) : null}
      {!favoritesOnly && !visibleRecipes.length ? <View style={[styles.emptyDiary, { backgroundColor: tone.accent }]}><Image source={chestnutMascot} style={styles.emptyChestnut} resizeMode="contain" /><Text style={[styles.settingText, { color: tone.ink }]}>Chestnut 没有找到这道菜</Text><Text style={[styles.note, { color: tone.muted }]}>换个关键词，或清除筛选再看看吧。</Text><Pressable onPress={() => { setQuery(""); setIngredientFilter(""); setTasteFilter(""); setTagFilter(""); setCategory("全部"); }}><Text style={{ color: tone.orange, fontWeight: "800", marginTop: 7 }}>清除全部筛选</Text></Pressable></View> : null}
      {orderedVisibleRecipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
      <View style={{ height: 16 }} />
      </View>
      </ScrollView>
    </View>
  );
  const Menu = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: tone.orange }]}>
            OUR LITTLE MENU
          </Text>
          <Text style={[styles.title, { color: tone.ink }]}>一起吃什么？</Text>
        </View>
        <Image source={doodleTableSetting} style={styles.headerDoodle} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryRow}
      >
        {stages.map((item, index) => (
          <Pressable
            key={item}
            onPress={() => setStage(item)}
            style={[
              styles.category,
              { backgroundColor: stage === item ? tone.orange : tone.card },
              { transform: [{ rotate: `${[-1.2, 0.8, -0.6, 1][index]}deg` }] },
            ]}
          >
            <Text
              style={[
                styles.categoryText,
                { color: stage === item ? "#fffaf0" : tone.ink },
              ]}
            >
              {stageSticker[item]} {item} {menuStageCounts[item] || ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[styles.menuHint, { color: tone.muted }]}>
        可以移动菜品到其他菜单页，或在此移除 · {syncStatus}
      </Text>
      {!recipeList.some((recipe) => menu[recipe.id] === stage) && (
        <View style={[styles.menuEmpty, { backgroundColor: tone.accent }]}>
          <Text style={styles.menuEmptyIcon}>🐾</Text>
          <Text style={[styles.settingText, { color: tone.ink }]}>
            这里还是空的
          </Text>
          <Text style={[styles.note, { color: tone.muted }]}>
            去菜谱本把想吃的菜收进菜单吧。
          </Text>
          <Pressable onPress={() => setTab("菜谱本")}>
            <Text
              style={{ color: tone.orange, fontWeight: "800", marginTop: 8 }}
            >
              去菜谱本 ›
            </Text>
          </Pressable>
        </View>
      )}
      {recipeList
        .filter((recipe) => menu[recipe.id] === stage)
        .map((recipe) => (
          <View
            key={recipe.id}
            style={[styles.menuCard, { backgroundColor: tone.card }]}
          >
            <View
              style={[styles.foodCircle, { backgroundColor: recipe.color }]}
            >
              {recipe.cover ? (
                <Image
                  source={{ uri: recipe.cover }}
                  style={styles.cardCover}
                />
              ) : (
                <Text style={styles.foodEmoji}>{recipe.emoji}</Text>
              )}
            </View>
            <View style={styles.recipeInfo}>
              <Text style={[styles.recipeName, { color: tone.ink }]}>
                {recipe.name}
              </Text>
              {menuNoteId === recipe.id ? (
                <View style={styles.menuNoteEditor}>
                  <TextInput
                    value={menuNoteText}
                    onChangeText={setMenuNoteText}
                    placeholder="写一张菜单便签"
                    placeholderTextColor={tone.muted}
                    style={[
                      styles.menuNoteInput,
                      { color: tone.ink, borderColor: tone.line },
                    ]}
                  />
                  <View style={styles.menuNoteActions}>
                    <Pressable onPress={() => saveMenuNote(recipe.id)}>
                      <Text style={{ color: tone.orange, fontWeight: "800" }}>
                        保存
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => setMenuNoteId(null)}>
                      <Text style={{ color: tone.muted }}>取消</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    setMenuNoteId(recipe.id);
                    setMenuNoteText(menuNotes[String(recipe.id)] || "");
                  }}
                >
                  <Text
                    style={[
                      styles.note,
                      {
                        color: menuNotes[String(recipe.id)]
                          ? tone.ink
                          : tone.muted,
                      },
                    ]}
                  >
                    {menuNotes[String(recipe.id)]
                      ? "📝 " + menuNotes[String(recipe.id)] + "  ✎"
                      : "📝 ＋ 添加菜单便签"}
                  </Text>
                </Pressable>
              )}
            </View>
            <View style={styles.menuActions}>
              {stage !== "已完成" && (
                <Pressable
                  onPress={() => toggleRecipePurchased(recipe)}
                  style={[
                    styles.menuPurchase,
                    {
                      backgroundColor: checked.includes(recipePurchaseKey(recipe.id))
                        ? tone.orange
                        : tone.accent,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: checked.includes(recipePurchaseKey(recipe.id))
                        ? "#fffaf0"
                        : tone.orange,
                      fontWeight: "800",
                    }}
                  >
                    {checked.includes(recipePurchaseKey(recipe.id)) ? "✓ 已采购" : "□ 采购"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                onPress={() => moveRecipe(recipe.id)}
                style={[styles.move, { backgroundColor: tone.accent }]}
              >
                <Text style={{ color: tone.orange }}>移动</Text>
              </Pressable>
              <Pressable onPress={() => removeFromMenu(recipe.id)}>
                <Text style={[styles.removeText, { color: tone.muted }]}>
                  移除
                </Text>
              </Pressable>
              {stage === "已完成" && (
                <Pressable onPress={() => markCooked(recipe)}>
                  <Text style={[styles.doneText, { color: tone.orange }]}>
                    记录做过
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        ))}
      <ImageBackground
        source={shoppingPaper}
        style={[styles.shoppingCard, styles.shoppingPaperBase]}
        imageStyle={styles.shoppingPaperImage}
      >
        <View
          pointerEvents="none"
          style={[styles.shoppingTape, styles.shoppingTapeLeft]}
        />
        <View
          pointerEvents="none"
          style={[styles.shoppingTape, styles.shoppingTapeRight]}
        />
        <View
          pointerEvents="none"
          style={[styles.shoppingTear, styles.shoppingTearTop]}
        />
        <View
          pointerEvents="none"
          style={[styles.shoppingTear, styles.shoppingTearBottom]}
        />
        <View style={styles.shoppingHeader}>
          <View style={styles.shoppingTitleRow}>
            <Image source={doodleBasket} style={styles.shoppingTitleDoodle} />
            <Text style={styles.shoppingTitle}>采购清单</Text>
          </View>
          {checked.length ? (
            <Pressable onPress={clearPurchased}>
              <Text style={styles.shoppingClear}>清空已购</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.shoppingScript}>选择要合计的菜单页面</Text>
        <View style={styles.tags}>
          {stages.filter((item) => item !== "已完成").map((item, index) => (
            <Pressable
              onPress={() => toggleStage(item)}
              key={item}
              style={[
                styles.stageChip,
                shoppingStages.includes(item)
                  ? styles.stageChipActive
                  : styles.stageChipIdle,
                { transform: [{ rotate: `${[-1, 1, -0.7, 0.8][index]}deg` }] },
              ]}
            >
              <Text
                style={[
                  styles.shoppingChipText,
                  shoppingStages.includes(item) &&
                    styles.shoppingChipTextActive,
                ]}
              >
                {shoppingStages.includes(item)
                  ? "✓ "
                  : stageSticker[item] + " "}
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.shoppingViewToggle}>
          {(["食材", "菜品"] as const).map((view) => (
            <Pressable
              key={view}
              onPress={() => setShoppingView(view)}
              style={[
                styles.shoppingViewChip,
                { backgroundColor: shoppingView === view ? "#C86D42" : "#F7DFA9CC" },
              ]}
            >
              <Text style={{ color: shoppingView === view ? "#FFF6D9" : "#4A3024", fontWeight: "800" }}>
                按{view}分类
              </Text>
            </Pressable>
          ))}
        </View>
        {shoppingComplete ? (
          <View style={styles.shoppingCompleteNote}>
            <Text style={styles.shoppingCompleteText}>✓ 已采购完成，开始做菜吧！</Text>
          </View>
        ) : shopping.length ? (
          <Text style={styles.shoppingProgress}>
            采购进度：还差 {remainingShoppingCount} 项
          </Text>
        ) : null}
        {shopping.length && shoppingView === "食材" ? (
          Object.entries(shoppingGroups).map(([group, items]) => (
            <View key={group}>
              <Text style={[styles.shoppingScript, styles.shoppingGroup]}>
                {group}
              </Text>
              {items.map(({ key, ingredient, from }) => (
                <Pressable
                  key={`${ingredient}-${from}`}
                  onPress={() => toggleCheck(key)}
                  style={styles.shoppingItem}
                >
                  <View
                    style={[
                      styles.handCheck,
                      checked.includes(key) && styles.handCheckDone,
                    ]}
                  >
                    {checked.includes(key) ? (
                      <Text style={styles.handCheckGlyph}>✓</Text>
                    ) : null}
                  </View>
                  <View>
                    <Text
                      style={[
                        styles.shoppingIngredient,
                        checked.includes(key) &&
                          styles.shoppingPurchased,
                      ]}
                    >
                      {ingredient}
                    </Text>
                    <Text style={styles.from}>{from}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ))
        ) : shopping.length && shoppingView === "菜品" ? (
          unpurchasedShoppingRecipes.map((recipe) => (
            <View key={recipe.id} style={styles.shoppingRecipeGroup}>
              <Text style={styles.shoppingRecipeName}>{recipe.name}</Text>
              {recipe.ingredients.map((raw, index) => {
                const item = shopping.find(
                  (entry) => entry.key === shoppingIngredient(raw).key,
                );
                const isChecked = !!item && checked.includes(item.key);
                return (
                  <Pressable
                    key={`${recipe.id}-${index}`}
                    onPress={() => item && toggleCheck(item.key)}
                    style={styles.shoppingItem}
                  >
                    <View style={[styles.handCheck, isChecked && styles.handCheckDone]}>
                      {isChecked ? <Text style={styles.handCheckGlyph}>✓</Text> : null}
                    </View>
                    <Text style={[styles.shoppingIngredient, isChecked && styles.shoppingPurchased]}>
                      {ingredientText(raw)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        ) : shoppingComplete ? null : (
          <Text style={styles.shoppingText}>
            {!shoppingStages.length
              ? "先勾选一个菜单页面吧。"
              : !shoppingRecipeCount
                ? "所选菜单页还没有菜，先去添加菜品吧。"
                : "这些菜还没有填写食材。"}
          </Text>
        )}
      </ImageBackground>
    </>
  );
  const Timer = () => (
    <View style={styles.timerPage}>
      <Text style={[styles.kicker, { color: tone.orange }]}>
        CHESTNUT'S KITCHEN CLOCK
      </Text>
      <Text style={[styles.title, { color: tone.ink }]}>厨房计时器</Text>
      <View style={[styles.timerNotePaper, { backgroundColor: tone.accent }]}>
        <View style={styles.timerTape}>
          <Text style={styles.timerTapeText}>KITCHEN NOTE</Text>
        </View>
        <Text style={[styles.timerTask, { color: tone.orange }]}>
          ✦ {timerRecipe ? `正在做：${timerRecipe.name}` : "Chestnut 的烹饪便利贴"}
        </Text>
        <View style={[styles.timerDisplay, { backgroundColor: tone.card }]}>
          <Text style={styles.timerCat}>🐾</Text>
          <Text style={[styles.timerDigits, { color: tone.ink }]}>
            {formattedTime}
          </Text>
          <Text style={[styles.timerHint, { color: tone.muted }]}>
            {running ? "正在为这一步计时" : "滚动下方转轮来设定时间"}
          </Text>
        </View>
        <Text style={[styles.timerMarginNote, { color: tone.muted }]}>
          记得在叮的一声前回来看看锅喔。
        </Text>
      </View>
      {!running && <View style={styles.quickTimerRow}>{[3, 5, 10, 15, 20, 30].map((minutes) => <Pressable key={minutes} onPress={() => { setTimerFinished(false); setTimerRecipe(null); setSeconds(minutes * 60); setSecondWheelIndex(60); }} style={[styles.quickTimer, { backgroundColor: tone.accent }]}><Text style={{ color: tone.orange }}>{minutes} 分</Text></Pressable>)}</View>}
      {Platform.OS === "web" ? (
        <View style={[styles.webTimerCard, { backgroundColor: tone.card, opacity: running ? 0.58 : 1 }]}>
          <View style={styles.wheelColumn}>
            <Text style={[styles.wheelLabel, { color: tone.muted }]}>分钟</Text>
            <ScrollView
              key={`web-minute-${Math.floor(seconds / 60)}`}
              ref={webMinuteWheelRef}
              style={styles.webWheel}
              contentContainerStyle={styles.webWheelContent}
              contentOffset={{ x: 0, y: Math.floor(seconds / 60) * 42 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!running}
              scrollEventThrottle={16}
              onScroll={(event) => settleWebWheel("minutes", event.nativeEvent.contentOffset.y)}
              onScrollEndDrag={(event) => settleWebWheel("minutes", event.nativeEvent.contentOffset.y)}
            >
              {Array.from({ length: 181 }, (_, value) => <Text key={value} style={[styles.webWheelItem, { color: tone.ink }]}>{String(value).padStart(2, "0")}</Text>)}
            </ScrollView>
            <View pointerEvents="none" style={[styles.webWheelSelection, { borderColor: tone.orange }]} />
          </View>
          <View style={styles.wheelDivider} />
          <View style={styles.wheelColumn}>
            <Text style={[styles.wheelLabel, { color: tone.muted }]}>秒</Text>
            <ScrollView
              key={`web-second-${secondWheelIndex}`}
              ref={webSecondWheelRef}
              style={styles.webWheel}
              contentContainerStyle={styles.webWheelContent}
              contentOffset={{ x: 0, y: secondWheelIndex * 42 }}
              showsVerticalScrollIndicator={false}
              scrollEnabled={!running}
              scrollEventThrottle={16}
              onScroll={(event) => settleWebWheel("seconds", event.nativeEvent.contentOffset.y)}
              onScrollEndDrag={(event) => settleWebWheel("seconds", event.nativeEvent.contentOffset.y)}
            >
              {Array.from({ length: 180 }, (_, value) => <Text key={value} style={[styles.webWheelItem, { color: tone.ink }]}>{String(value % 60).padStart(2, "0")}</Text>)}
            </ScrollView>
            <View pointerEvents="none" style={[styles.webWheelSelection, { borderColor: tone.orange }]} />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.wheelCard,
            { backgroundColor: tone.card, opacity: running ? 0.58 : 1 },
          ]}
        >
          <View style={styles.wheelColumn}>
            <Text style={[styles.wheelLabel, { color: tone.muted }]}>分钟</Text>
            <Picker
              enabled={!running}
              selectedValue={Math.floor(seconds / 60)}
              onValueChange={(minutes) => {
                setRunning(false);
                setSeconds(Number(minutes) * 60 + (seconds % 60));
              }}
              itemStyle={{ color: tone.ink, fontSize: 22 }}
              style={styles.wheel}
            >
              {Array.from({ length: 181 }, (_, value) => <Picker.Item key={value} label={`${value}`} value={value} color={tone.ink} />)}
            </Picker>
          </View>
          <View style={styles.wheelDivider} />
          <View style={styles.wheelColumn}>
            <Text style={[styles.wheelLabel, { color: tone.muted }]}>秒</Text>
            <Picker
              enabled={!running}
              selectedValue={secondWheelIndex}
              onValueChange={(value) => {
                const wheelValue = Number(value);
                setRunning(false);
                setSecondWheelIndex(wheelValue);
                setSeconds(Math.floor(seconds / 60) * 60 + (wheelValue % 60));
              }}
              itemStyle={{ color: tone.ink, fontSize: 22 }}
              style={styles.wheel}
            >
              {Array.from({ length: 180 }, (_, value) => <Picker.Item key={value} label={`${value % 60}`} value={value} color={tone.ink} />)}
            </Picker>
          </View>
        </View>
      )}
      <View style={styles.timerControls}>
        <Pressable
          onPress={toggleTimer}
          style={[styles.startButton, { backgroundColor: tone.orange }]}
        >
          <Text style={styles.spinText}>
            {running ? "暂停便利贴" : "开始计时"}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setRunning(false);
            setTimerFinished(false);
            setTimerRecipe(null);
            setSeconds(15 * 60);
            setSecondWheelIndex(60);
          }}
          style={[styles.roundButton, { backgroundColor: tone.accent }]}
        >
          <Text style={{ color: tone.ink }}>↺ 重置</Text>
        </Pressable>
      </View>
      {timerFinished && <View style={[styles.timerDoneCard, { backgroundColor: tone.card, borderColor: tone.line }]}><Text style={[styles.settingText, { color: tone.ink }]}>✦ 这一张便利贴完成啦！</Text><Text style={[styles.note, { color: tone.muted }]}>{timerRecipe ? `「${timerRecipe.name}」现在可以记录为做过。` : "这一轮计时已经结束。"}</Text>{timerRecipe && <Pressable onPress={() => { markCooked(timerRecipe); setTimerFinished(false); }} style={[styles.timerDoneButton, { backgroundColor: tone.orange }]}><Text style={styles.spinText}>记录这道菜做过</Text></Pressable>}</View>}
      <Text style={[styles.timerNote, { color: tone.muted }]}>
        {notificationsEnabled
          ? "计时结束后，Chestnut 会用铃声提醒你。"
          : "计时提醒已关闭，倒计时仍会继续。"}
      </Text>
    </View>
  );
  const Settings = () => (
    <>
      <Pressable
        onPress={() => {
          setFamilyEditing(false);
          setSettingsOpen(false);
        }}
      >
        <Text style={[styles.back, { color: tone.orange }]}>‹ 返回我的</Text>
      </Pressable>
      <Text style={[styles.kicker, { color: tone.orange }]}>KITCHEN SETTINGS</Text>
      <Text style={[styles.detailTitle, { color: tone.ink }]}>
        {settingsSection === "家庭" ? "家庭设置" : "设置"}
      </Text>
      {settingsSection === "家庭" && familyEditing && (
        <View style={[styles.formCard, { backgroundColor: tone.card }]}>
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>家庭名称</Text>
          <TextInput
            value={familyName}
            onChangeText={setFamilyName}
            placeholder="我们的厨房"
            placeholderTextColor={tone.muted}
            style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
          />
          <View style={styles.fieldRow}>
            <Pressable onPress={saveFamilyName} style={[styles.roundButton, { backgroundColor: tone.orange }]}>
              <Text style={styles.spinText}>保存</Text>
            </Pressable>
            <Pressable onPress={() => setFamilyEditing(false)} style={[styles.roundButton, { backgroundColor: tone.accent }]}>
              <Text style={{ color: tone.ink }}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}
      <View style={[styles.settings, { backgroundColor: tone.card }]}>
        {settingsSection === "家庭" && <>
        <Pressable onPress={() => setFamilyEditing(true)} style={styles.settingRow}><View><Text style={[styles.settingText, { color: tone.ink }]}>🏠 {familyName || "我们的厨房"}</Text><Text style={[styles.settingHint, { color: tone.muted }]}>点击修改家庭名称</Text></View><Text style={{ color: tone.orange, fontWeight: "800" }}>✎</Text></Pressable>
        <Pressable onPress={copyInviteCode} style={styles.settingRow}><Text style={[styles.settingText, { color: tone.ink }]}>🏠 家庭邀请码</Text><Text style={{ color: tone.orange }}>{familyInviteCode || "读取中…"}　复制</Text></Pressable>
        <Pressable onPress={leaveFamily} style={styles.settingRow}><Text style={[styles.settingText, { color: "#B85740" }]}>退出当前家庭</Text><Text style={{ color: "#B85740", fontWeight: "800" }}>›</Text></Pressable>
        </>}
        {settingsSection === "偏好" && <>
        <View style={styles.settingRow}><View><Text style={[styles.settingText, { color: tone.ink }]}>🔔 厨房计时提醒</Text><Text style={[styles.settingHint, { color: tone.muted }]}>通知权限：{notificationPermission}</Text></View><Switch value={notificationsEnabled} onValueChange={(value) => { if (value) void updateNotificationPermission(); else setNotificationsEnabled(false); }} trackColor={{ false: "#D6C0A5", true: tone.orange }} /></View>
        <Pressable onPress={testNotification} style={styles.settingRow}><View><Text style={[styles.settingText, { color: tone.ink }]}>🐾 发送测试提醒</Text><Text style={[styles.settingHint, { color: tone.muted }]}>3 秒后确认铃声和横幅是否正常</Text></View><Text style={{ color: tone.orange, fontWeight: "800" }}>试一下 ›</Text></Pressable>
        <View style={styles.settingRow}><Text style={[styles.settingText, { color: tone.ink }]}>🌙 夜间厨房手账风</Text><Switch value={dark} onValueChange={setDark} trackColor={{ false: "#D6C0A5", true: tone.orange }} /></View>
        <Pressable onPress={offerLegacyRecovery} style={styles.settingRow}><View><Text style={[styles.settingText, { color: tone.ink }]}>📦 恢复本机旧菜谱</Text><Text style={[styles.settingHint, { color: tone.muted }]}>{legacyRecipeCount ? `发现 ${legacyRecipeCount} 道可恢复的旧菜谱` : "检查这台手机上的旧版本缓存"}</Text></View><Text style={{ color: tone.orange, fontWeight: "800" }}>›</Text></Pressable>
        <Pressable onPress={cleanDuplicateRecipes} style={styles.settingRow}><View><Text style={[styles.settingText, { color: tone.ink }]}>✂️ 清理重复菜谱</Text><Text style={[styles.settingHint, { color: tone.muted }]}>只移除内容完全相同的重复项</Text></View><Text style={{ color: tone.orange, fontWeight: "800" }}>›</Text></Pressable>
        <Pressable onPress={signOut} style={styles.settingRow}><Text style={[styles.settingText, { color: "#B85740" }]}>退出登录</Text><Text style={{ color: "#B85740", fontWeight: "800" }}>›</Text></Pressable>
        </>}
      </View>
    </>
  );
  const Profile = () => (
    <>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: tone.orange }]}>
            OUR HOME · 0822
          </Text>
          <Text style={[styles.title, { color: tone.ink }]}>我的小厨房</Text>
        </View>
        <Image source={doodleChestnut} style={styles.headerDoodle} />
      </View>
      <View style={[styles.profileCard, { backgroundColor: tone.card }]}>
        <Pressable
          onPress={() =>
            chooseImage((avatar_url) => {
              setProfile({ ...profile, avatar_url });
              setProfileEditing(true);
            })
          }
          style={[styles.avatar, { backgroundColor: tone.accent }]}
        >
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.cardCover}
            />
          ) : (
            <Text style={styles.avatarText}>
              {profile.display_name.slice(0, 1)}
            </Text>
          )}
        </Pressable>
        <View style={styles.recipeInfo}>
          <Text style={[styles.recipeName, { color: tone.ink }]}>
            {profile.display_name}
          </Text>
          <Text style={[styles.recipeMeta, { color: tone.muted }]}>
            {profile.bio || "写一句个人介绍吧"}
          </Text>
        </View>
        <Pressable onPress={() => setProfileEditing(true)}>
          <Text style={[styles.familyBadge, { color: tone.orange }]}>✎</Text>
        </Pressable>
      </View>
      {profileEditing && (
        <View style={[styles.formCard, { backgroundColor: tone.card }]}>
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>昵称</Text>
          <TextInput
            value={profile.display_name}
            onChangeText={(display_name) =>
              setProfile({ ...profile, display_name })
            }
            style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
          />
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>个人介绍</Text>
          <TextInput
            value={profile.bio}
            onChangeText={(bio) => setProfile({ ...profile, bio })}
            placeholder="例如：Chestnut 的铲屎官，最爱吃辣"
            placeholderTextColor={tone.muted}
            style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
          />
          <View style={styles.fieldRow}>
            <Pressable
              onPress={saveProfile}
              style={[styles.roundButton, { backgroundColor: tone.orange }]}
            >
              <Text style={styles.spinText}>保存</Text>
            </Pressable>
            <Pressable
              onPress={() => setProfileEditing(false)}
              style={[styles.roundButton, { backgroundColor: tone.accent }]}
            >
              <Text style={{ color: tone.ink }}>取消</Text>
            </Pressable>
          </View>
        </View>
      )}
      <Pressable
        onPress={() => {
          setSettingsSection("家庭");
          setSettingsOpen(true);
        }}
        style={[
          styles.familyOverview,
          { backgroundColor: tone.accent, borderColor: tone.line },
        ]}
      >
        <View style={styles.familyOverviewIcon}>
          <Text style={{ fontSize: 22 }}>🏠</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.settingText, { color: tone.ink }]}>
            🏠 {familyName || "我们的厨房"}
          </Text>
          <Text style={[styles.settingHint, { color: tone.muted }]}>
            {members.length}/3 位成员 · {syncStatus}
          </Text>
        </View>
        <Text style={{ color: tone.orange, fontWeight: "800", fontSize: 19 }}>›</Text>
      </Pressable>
      <Text style={[styles.sectionTitle, { color: tone.ink, marginTop: 22 }]}>
        厨房小记
      </Text>
      <View style={styles.kitchenStats}>
        {[
          ["收录菜谱", `${recipeList.length} 道`],
          ["做饭次数", `${totalCookedCount} 次`],
          ["待做菜单", `${activeMenuCount} 道`],
        ].map(([label, value], index) => (
          <View
            key={label}
            style={[
              styles.kitchenStat,
              {
                backgroundColor: index === 1 ? tone.accent : tone.card,
                borderColor: tone.line,
                transform: [{ rotate: `${[-1, 0.6, -0.5][index]}deg` }],
              },
            ]}
          >
            <Image source={kitchenStatArt[index]} style={styles.kitchenStatIcon} />
            <Text style={[styles.kitchenStatValue, { color: tone.ink }]}>{value}</Text>
            <Text style={[styles.kitchenStatLabel, { color: tone.muted }]}>{label}</Text>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => setTab(activeMenuCount ? "菜单" : "菜谱本")}
        style={[styles.chestnutNoteCard, { backgroundColor: tone.card, borderColor: tone.line }]}
      >
        <Text style={styles.chestnutPin}>●</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chestnutNoteTitle, { color: tone.ink }]}>Chestnut 的小纸条</Text>
          <Text style={[styles.chestnutNoteText, { color: tone.muted }]}>{chestnutNote}</Text>
        </View>
        <Text style={[styles.chestnutNoteArrow, { color: tone.orange }]}>›</Text>
      </Pressable>
      <Text style={[styles.sectionTitle, { color: tone.ink, marginTop: 24 }]}>
        家庭成员（{members.length}/3）
      </Text>
      <View style={[styles.settings, { backgroundColor: tone.card }]}>
        {members.map((member, index) => {
          const isMe = member.user_id === session?.user.id;
          const memberName = isMe
            ? profile.display_name
            : member.display_name || `成员 ${index + 1}`;
          const memberAvatar = isMe ? profile.avatar_url : member.avatar_url;
          const memberNote = isMe ? "" : memberNotes[member.user_id];
          const isOwner = member.user_id === familyOwnerId;
          const joinedLabel = member.joined_at
            ? `加入于 ${new Date(member.joined_at).toLocaleDateString("zh-CN", {
                month: "numeric",
                day: "numeric",
              })}`
            : "家庭成员";
          return (
            <View key={member.user_id}>
              <View style={styles.settingRow}>
                <Pressable
                  onPress={() =>
                    setMemberProfileId(
                      memberProfileId === member.user_id
                        ? null
                        : member.user_id,
                    )
                  }
                  style={styles.memberIdentity}
                >
                  <View
                    style={[
                      styles.memberAvatar,
                      { backgroundColor: tone.accent },
                    ]}
                  >
                    {memberAvatar ? (
                      <Image
                        source={{ uri: memberAvatar }}
                        style={styles.memberAvatarImage}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.memberAvatarText,
                          { color: tone.orange },
                        ]}
                      >
                        {memberName.slice(0, 1)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: tone.ink }]}>
                      {memberName}
                      {memberNote ? `（${memberNote}）` : ""}
                    </Text>
                    <Text style={[styles.memberRole, { color: tone.muted }]}>
                      {isOwner ? "✦ 创建者" : "○ 成员"} · {joinedLabel}
                    </Text>
                  </View>
                </Pressable>
                {!isMe && (
                  <Pressable
                    onPress={() => {
                      setNoteTarget(member.user_id);
                      setNoteText(memberNote || "");
                    }}
                  >
                    <Text
                      style={{
                        color: tone.orange,
                        fontSize: 19,
                        fontWeight: "800",
                        marginLeft: 10,
                      }}
                    >
                      ✎
                    </Text>
                  </Pressable>
                )}
                {familyOwnerId === session?.user.id && !isMe && (
                  <Pressable onPress={() => removeMember(member.user_id)}>
                    <Text
                      style={{
                        color: "#B85740",
                        fontWeight: "800",
                        marginLeft: 12,
                      }}
                    >
                      移出
                    </Text>
                  </Pressable>
                )}
              </View>
              {memberProfileId === member.user_id && (
                <View
                  style={[
                    styles.memberProfilePreview,
                    { backgroundColor: tone.accent },
                  ]}
                >
                  <View
                    style={[
                      styles.memberProfileAvatar,
                      { backgroundColor: tone.card },
                    ]}
                  >
                    {memberAvatar ? (
                      <Image
                        source={{ uri: memberAvatar }}
                        style={styles.memberProfileAvatarImage}
                      />
                    ) : (
                      <Text style={[styles.avatarText, { color: tone.orange }]}>
                        {memberName.slice(0, 1)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingText, { color: tone.ink }]}>
                      {isMe ? "这是你" : "对方的 Profile"}
                    </Text>
                    <Text style={[styles.recipeMeta, { color: tone.muted }]}>
                      {member.bio || "还没有写个人介绍"}
                    </Text>
                  </View>
                  <Pressable onPress={() => setMemberProfileId(null)}>
                    <Text style={{ color: tone.muted, fontWeight: "800" }}>
                      收起
                    </Text>
                  </Pressable>
                </View>
              )}
              {noteTarget === member.user_id && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                  <TextInput
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="例如：我的小厨师"
                    placeholderTextColor={tone.muted}
                    style={[
                      styles.field,
                      { color: tone.ink, borderColor: tone.line },
                    ]}
                  />
                  <View style={styles.fieldRow}>
                    <Pressable
                      onPress={saveMemberNote}
                      style={[
                        styles.roundButton,
                        { backgroundColor: tone.orange },
                      ]}
                    >
                      <Text style={styles.spinText}>保存</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setNoteTarget(null)}
                      style={[
                        styles.roundButton,
                        { backgroundColor: tone.accent },
                      ]}
                    >
                      <Text style={{ color: tone.ink }}>取消</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </View>
          );
        })}
      </View>
      <Pressable
        onPress={() => {
          setSettingsSection("偏好");
          setSettingsOpen(true);
        }}
        style={[
          styles.settingsEntry,
          { backgroundColor: tone.accent, borderColor: tone.line },
        ]}
      >
        <View>
          <Text style={[styles.settingText, { color: tone.ink }]}>⚙️ 设置</Text>
          <Text style={[styles.settingHint, { color: tone.muted }]}>提醒、夜间模式、数据维护与账户</Text>
        </View>
        <Text style={{ color: tone.orange, fontSize: 22, fontWeight: "800" }}>›</Text>
      </Pressable>
    </>
  );
  const Composer = () => (
    <>
      <Pressable onPress={() => setComposer(false)}>
        <Text style={[styles.back, { color: tone.orange }]}>‹ 取消录入</Text>
      </Pressable>
      <Text style={[styles.kicker, { color: tone.orange }]}>NEW RECIPE</Text>
      <Text style={[styles.detailTitle, { color: tone.ink }]}>收进栗刻</Text>
      <View style={[styles.formCard, { backgroundColor: tone.card }]}>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>菜名 *</Text>
        <TextInput
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder="例如：黑椒牛柳"
          placeholderTextColor={tone.muted}
          style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
        />
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>分类</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.slice(1).map((item) => (
            <Pressable
              key={item}
              onPress={() => setDraft({ ...draft, category: item })}
              style={[
                styles.category,
                {
                  backgroundColor:
                    draft.category === item ? tone.orange : tone.accent,
                },
              ]}
            >
              <Text
                style={{ color: draft.category === item ? "#fff" : tone.ink }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        {MediaPanel()}
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>
            食材与用量 *
          </Text>
          <Pressable
            onPress={() =>
              setDraft({
                ...draft,
                ingredients: [
                  ...draft.ingredients,
                  { name: "", quantity: "", unit: "克", type: "其他" },
                ],
              })
            }
          >
            <Text style={{ color: tone.orange, fontWeight: "800" }}>
              ＋ 添加食材
            </Text>
          </Pressable>
        </View>
        {draft.ingredients.map((ingredient, index) => (
          <View
            key={index}
            style={[styles.ingredientRow, { borderColor: tone.line }]}
          >
            <TextInput
              value={ingredient.name}
              onChangeText={(name) =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.map((item, i) =>
                    i === index ? { ...item, name } : item,
                  ),
                })
              }
              placeholder="食材名称"
              placeholderTextColor={tone.muted}
              style={[styles.ingredientName, { color: tone.ink }]}
            />
            <TextInput
              value={ingredient.quantity}
              onChangeText={(quantity) =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.map((item, i) =>
                    i === index ? { ...item, quantity } : item,
                  ),
                })
              }
              keyboardType="decimal-pad"
              placeholder="数量"
              placeholderTextColor={tone.muted}
              style={[styles.quantity, { color: tone.ink }]}
            />
            <Pressable
              onPress={() =>
                Alert.alert(
                  "选择单位",
                  undefined,
                  ["克", "毫升", "个", "勺", "把", "适量"].map((unit) => ({
                    text: unit,
                    onPress: () =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.map((item, i) =>
                          i === index ? { ...item, unit } : item,
                        ),
                      }),
                  })),
                )
              }
              style={[styles.unitButton, { backgroundColor: tone.accent }]}
            >
              <Text style={{ color: tone.ink }}>{ingredient.unit}⌄</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>
            制作步骤 *
          </Text>
          <Pressable
            onPress={() =>
              setDraft({ ...draft, steps: [...draft.steps, { text: "" }] })
            }
          >
            <Text style={{ color: tone.orange, fontWeight: "800" }}>
              ＋ 添加步骤
            </Text>
          </Pressable>
        </View>
        {draft.steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <Text
              style={[
                styles.stepNumber,
                { backgroundColor: tone.accent, color: tone.orange },
              ]}
            >
              {index + 1}
            </Text>
            <TextInput
              value={step.text || ""}
              onChangeText={(text) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((item, i) =>
                    i === index ? { ...item, text } : item,
                  ),
                })
              }
              placeholder="写下这一小步怎么做"
              placeholderTextColor={tone.muted}
              multiline
              style={[
                styles.stepInput,
                { color: tone.ink, borderColor: tone.line },
              ]}
            />
          </View>
        ))}
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>
          口味 · 耗时
        </Text>
        <View style={styles.fieldRow}>
          <TextInput
            value={draft.taste}
            onChangeText={(taste) => setDraft({ ...draft, taste })}
            placeholder="微辣"
            placeholderTextColor={tone.muted}
            style={[
              styles.field,
              styles.halfField,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
          <TextInput
            value={draft.time}
            onChangeText={(time) => setDraft({ ...draft, time })}
            placeholder="20 分钟"
            placeholderTextColor={tone.muted}
            style={[
              styles.field,
              styles.halfField,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
        </View>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>手账标签</Text>
        <View style={styles.draftTags}>
          {draftTagList.map((tag, index) => (
            <View
              key={tag}
              style={[
                styles.draftTag,
                {
                  backgroundColor: ["#FFF1C9", "#F8D9D3", "#DDE9D4", "#D9E7F5"][
                    index % 4
                  ],
                },
              ]}
            >
              <Text style={[styles.draftTagText, { color: tone.ink }]}>
                {tag}
              </Text>
              <Pressable onPress={() => removeDraftTag(tag)} hitSlop={8}>
                <Text style={[styles.draftTagDelete, { color: tone.muted }]}>
                  ×
                </Text>
              </Pressable>
            </View>
          ))}
          {tagAdding ? (
            <View style={styles.tagAddPanel}>
            <View style={styles.tagAddRow}>
              <TextInput
                value={tagEntry}
                onChangeText={setTagEntry}
                onSubmitEditing={addDraftTag}
                autoFocus
                returnKeyType="done"
                placeholder="例如：快手"
                placeholderTextColor={tone.muted}
                style={[
                  styles.tagAddInput,
                  {
                    color: tone.ink,
                    borderColor: tone.line,
                    backgroundColor: tone.card,
                  },
                ]}
              />
              <Pressable
                onPress={addDraftTag}
                style={[styles.tagConfirm, { backgroundColor: tone.orange }]}
              >
                <Text style={styles.spinText}>添加</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setTagEntry("");
                  setTagAdding(false);
                }}
              >
                <Text style={{ color: tone.muted, fontSize: 12 }}>取消</Text>
              </Pressable>
            </View>
            {familyTags.filter((tag) => !draftTagList.includes(tag)).length ? <View style={styles.tagReuseRow}><Text style={[styles.tagReuseLabel, { color: tone.muted }]}>复用已有：</Text>{familyTags.filter((tag) => !draftTagList.includes(tag)).map((tag, index) => <Pressable key={tag} onPress={() => setDraft({ ...draft, tags: [...draftTagList, tag].join("，") })} style={[styles.tagReuseChip, { backgroundColor: ['#FFF1C9', '#F8D9D3', '#DDE9D4', '#D9E7F5'][index % 4] }]}><Text style={{ color: tone.ink, fontSize: 12 }}>＋ {tag}</Text></Pressable>)}</View> : null}
            </View>
          ) : (
            <Pressable
              onPress={() => setTagAdding(true)}
              style={[styles.tagAddButton, { backgroundColor: tone.accent }]}
            >
              <Text style={{ color: tone.orange, fontWeight: "800" }}>
                ＋ 添加标签
              </Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>小备注</Text>
        <TextInput
          value={draft.note}
          onChangeText={(note) => setDraft({ ...draft, note })}
          placeholder="留给未来的我们…"
          placeholderTextColor={tone.muted}
          style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
        />
        <Pressable
          onPress={saveRecipe}
          disabled={savingRecipe}
          style={[
            styles.saveButton,
            { backgroundColor: tone.orange, opacity: savingRecipe ? 0.58 : 1 },
          ]}
        >
          <Text style={styles.spinText}>
            {savingRecipe ? "正在保存…" : "保存这道菜谱"}
          </Text>
        </Pressable>
      </View>
    </>
  );
  const Detail = () =>
    detail && (
      <>
        <Pressable onPress={() => setDetail(null)}>
          <Text style={[styles.back, { color: tone.orange }]}>
            ‹ 返回菜谱本
          </Text>
        </Pressable>
        <View style={[styles.detailHero, { backgroundColor: detail.color }]}>
          {detail.cover ? (
            <Image source={{ uri: detail.cover }} style={styles.detailPhoto} />
          ) : (
            <Text style={styles.detailEmoji}>{detail.emoji}</Text>
          )}
        </View>
        <Text style={[styles.kicker, { color: tone.orange }]}>
          {detail.category.toUpperCase()} · {detail.difficulty} · {detail.time}
        </Text>
        <Text style={[styles.detailTitle, { color: tone.ink }]}>
          {detail.name}
        </Text>
        <View style={styles.detailActions}>
          <Pressable onPress={() => toggleFavorite(detail.id)} style={[styles.detailAction, { backgroundColor: tone.accent }]}><Text style={{ color: tone.orange }}>{favorites.includes(detail.id) ? "♥ 已收藏" : "♡ 收藏"}</Text></Pressable>
          <Pressable onPress={() => moveRecipe(detail.id)} style={[styles.detailAction, { backgroundColor: tone.accent }]}><Text style={{ color: tone.orange }}>＋ 加菜单</Text></Pressable>
          <Pressable onPress={() => editRecipe(detail)} style={[styles.detailAction, { backgroundColor: tone.card, borderColor: tone.line }]}><Text style={{ color: tone.muted }}>✎ 编辑</Text></Pressable>
          <Pressable onPress={() => duplicateRecipe(detail)} style={[styles.detailAction, { backgroundColor: tone.card, borderColor: tone.line }]}><Text style={{ color: tone.muted }}>⧉ 复制</Text></Pressable>
        </View>
        <View style={[styles.cookDiary, { backgroundColor: tone.accent }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.settingText, { color: tone.ink }]}>
              🍳 做过次数
            </Text>
            {cookCountEditing ? (
              <View style={styles.cookCountEditor}>
                <TextInput
                  value={cookCountText}
                  onChangeText={setCookCountText}
                  keyboardType="number-pad"
                  autoFocus
                  style={[
                    styles.cookCountInput,
                    {
                      color: tone.ink,
                      borderColor: tone.line,
                      backgroundColor: tone.card,
                    },
                  ]}
                />
                <Text style={{ color: tone.ink }}>次</Text>
                <Pressable onPress={() => saveCookCount(detail)}>
                  <Text
                    style={{
                      color: tone.orange,
                      fontWeight: "800",
                      marginLeft: 5,
                    }}
                  >
                    保存
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setCookCountText(String(detail.cookedCount || 0));
                    setCookCountEditing(false);
                  }}
                >
                  <Text style={{ color: tone.muted, marginLeft: 5 }}>取消</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cookCountEditor}>
                <Text style={[styles.cookCountValue, { color: tone.ink }]}>
                  {detail.cookedCount || 0} 次
                </Text>
                <Pressable
                  onPress={() => {
                    setCookCountStatus("");
                    setCookCountEditing(true);
                  }}
                >
                  <Text
                    style={{
                      color: tone.orange,
                      fontSize: 18,
                      fontWeight: "800",
                    }}
                  >
                    ✎
                  </Text>
                </Pressable>
                {cookCountStatus ? (
                  <Text
                    style={[styles.cookCountStatus, { color: tone.orange }]}
                  >
                    {cookCountStatus}
                  </Text>
                ) : null}
              </View>
            )}
            <Text style={[styles.recipeMeta, { color: tone.muted }]}>
              {detail.lastCookedAt
                ? `上次做：${new Date(detail.lastCookedAt).toLocaleDateString("zh-CN")}`
                : "还没做过，等你们开灶！"}
            </Text>
          </View>
          <Pressable
            onPress={() => markCooked(detail)}
            style={[styles.cookButton, { backgroundColor: tone.orange }]}
          >
            <Text style={styles.spinText}>今天做过</Text>
          </Pressable>
        </View>
        <View
          style={[
            styles.diaryStrip,
            { backgroundColor: tone.card, borderColor: tone.line },
          ]}
        >
          <Text style={[styles.diaryStamp, { color: tone.orange }]}>
            KITCHEN LOG
          </Text>
          <Text style={[styles.note, { color: tone.ink, marginTop: 2 }]}>
            {detail.cookedCount
              ? `这是第 ${detail.cookedCount} 次做它；${detail.lastCookedAt ? new Date(detail.lastCookedAt).toLocaleDateString("zh-CN") + " 最近开过灶。" : ""}`
              : "第一笔厨房记录，等你们把它做出来。"}
          </Text>
          <Text style={[styles.note, { color: tone.muted }]}>
            {detail.reviews?.length
              ? `已经收下 ${detail.reviews.length} 条小小评价`
              : "还没有评价，做完写一句吧。"}
          </Text>
        </View>
        <View style={[styles.detailBox, { backgroundColor: tone.card }]}>
          <Text style={[styles.sectionTitle, { color: tone.ink }]}>食材</Text>
          {detail.ingredients.map((item, index) => (
            <Text
              key={`${ingredientText(item)}-${index}`}
              style={[styles.ingredient, { color: tone.ink }]}
            >
              • {ingredientText(item)}
            </Text>
          ))}
        </View>
        <View style={[styles.detailBox, { backgroundColor: tone.card }]}>
          <Text style={[styles.sectionTitle, { color: tone.ink }]}>
            制作步骤
          </Text>
          {detail.steps.map((item: any, index) => (
            <View key={index} style={styles.detailStep}>
              <Text
                style={[
                  styles.stepNumber,
                  { backgroundColor: tone.accent, color: tone.orange },
                ]}
              >
                {index + 1}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.note, { color: tone.ink, marginTop: 0 }]}>
                  {typeof item === "string" ? item : item.text}
                </Text>
                {typeof item !== "string" && item.image && (
                  <Image
                    source={{ uri: item.image }}
                    style={styles.stepPhoto}
                  />
                )}
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.detailBox, { backgroundColor: tone.card }]}>
          <Text style={[styles.sectionTitle, { color: tone.ink }]}>
            小小评价
          </Text>
          {(detail.reviews || []).map((review) => (
            <View
              key={review.id}
              style={[styles.reviewItem, { borderColor: tone.line }]}
            >
              <Text style={[styles.settingText, { color: tone.ink }]}>
                {review.author_name}
                {review.created_at
                  ? ` · ${new Date(review.created_at).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                    })}`
                  : ""}
              </Text>
              <Text style={[styles.note, { color: tone.muted }]}>
                {review.text}
              </Text>
            </View>
          ))}
          <TextInput
            value={reviewText}
            onChangeText={setReviewText}
            placeholder="写下这次的味道、想法…"
            placeholderTextColor={tone.muted}
            style={[
              styles.field,
              { color: tone.ink, borderColor: tone.line, marginTop: 10 },
            ]}
          />
          <Pressable
            onPress={() => leaveReview(detail)}
            style={[styles.reviewButton, { backgroundColor: tone.accent }]}
          >
            <Text style={{ color: tone.orange, fontWeight: "800" }}>
              ＋ 留下评价
            </Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            const recipeSeconds = secondsFromCookTime(detail.time);
            setSeconds(recipeSeconds);
            setSecondWheelIndex(60 + (recipeSeconds % 60));
            setTimerFinished(false);
            setTimerRecipe(detail);
            setTab("计时器");
            setDetail(null);
          }}
          style={[styles.detailTimer, { backgroundColor: tone.orange }]}
        >
          <Text style={styles.spinText}>◷ 打开烹饪计时器</Text>
        </Pressable>
      </>
    );
  const MediaPanel = () => (
    <View style={[styles.mediaPanel, { backgroundColor: tone.card }]}>
      <Text style={[styles.fieldLabel, { color: tone.ink }]}>菜谱封面</Text>
      <Pressable
        onPress={() => chooseImage((cover) => setDraft({ ...draft, cover }))}
        style={[styles.photoButton, { backgroundColor: tone.accent }]}
      >
        {draft.cover ? (
          <Image source={{ uri: draft.cover }} style={styles.coverPreview} />
        ) : (
          <Text style={{ color: tone.orange, fontWeight: "800" }}>
            ＋ 从相册选择封面图
          </Text>
        )}
      </Pressable>
      <Text style={[styles.fieldLabel, { color: tone.ink }]}>步骤图片</Text>
      {draft.steps.map((step, index) => (
        <Pressable
          key={index}
          onPress={() =>
            chooseImage((image) =>
              setDraft({
                ...draft,
                steps: draft.steps.map((item, i) =>
                  i === index ? { ...item, image } : item,
                ),
              }),
            )
          }
          style={[styles.stepImageButton, { borderColor: tone.line }]}
        >
          {step.image ? (
            <View style={styles.stepPhotoWrap}>
              <Image source={{ uri: step.image }} style={styles.stepPreview} />
              <View
                style={[
                  styles.stepPhotoLabel,
                  { backgroundColor: tone.orange },
                ]}
              >
                <Text style={styles.stepPhotoLabelText}>
                  步骤 {index + 1} 的过程图
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: tone.muted }}>
              步骤 {index + 1}　＋ 添加过程图
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
  const Editor = () => (
    <>
      <Pressable onPress={() => setComposer(false)}>
        <Text style={[styles.back, { color: tone.orange }]}>‹ 取消录入</Text>
      </Pressable>
      <Text style={[styles.detailTitle, { color: tone.ink }]}>
        {editingId ? "编辑菜谱" : "收进栗刻"}
      </Text>
      <View style={[styles.formCard, { backgroundColor: tone.card }]}>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>菜名 *</Text>
        <TextInput
          value={draft.name}
          onChangeText={(name) => setDraft({ ...draft, name })}
          placeholder="例如：黑椒牛柳"
          placeholderTextColor={tone.muted}
          style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
        />
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>分类</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          {categories.slice(1).map((item) => (
            <Pressable
              key={item}
              onPress={() => setDraft({ ...draft, category: item })}
              style={[
                styles.category,
                {
                  backgroundColor:
                    draft.category === item ? tone.orange : tone.accent,
                },
              ]}
            >
              <Text
                style={{ color: draft.category === item ? "#fff" : tone.ink }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>难度</Text>
        <View style={styles.tags}>
          {["简单", "普通", "挑战"].map((item) => (
            <Pressable
              key={item}
              onPress={() => setDraft({ ...draft, difficulty: item })}
              style={[
                styles.difficultyChip,
                {
                  backgroundColor:
                    draft.difficulty === item ? tone.orange : tone.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: draft.difficulty === item ? "#fffaf0" : tone.ink,
                }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>
        {MediaPanel()}
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>
            食材与用量 *
          </Text>
          <Pressable
            onPress={() =>
              setDraft({
                ...draft,
                ingredients: [
                  ...draft.ingredients,
                  { name: "", quantity: "", unit: "克", type: "其他" },
                ],
              })
            }
          >
            <Text style={{ color: tone.orange, fontWeight: "800" }}>
              ＋ 添加食材
            </Text>
          </Pressable>
        </View>
        {draft.ingredients.map((item, index) => (
          <View
            key={index}
            style={[styles.ingredientRow, { borderColor: tone.line }]}
          >
            <TextInput
              value={item.name}
              onChangeText={(name) =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.map((v, i) =>
                    i === index ? { ...v, name } : v,
                  ),
                })
              }
              placeholder="食材名称"
              placeholderTextColor={tone.muted}
              style={[styles.ingredientName, { color: tone.ink }]}
            />
            <TextInput
              value={item.quantity}
              onChangeText={(quantity) =>
                setDraft({
                  ...draft,
                  ingredients: draft.ingredients.map((v, i) =>
                    i === index ? { ...v, quantity } : v,
                  ),
                })
              }
              keyboardType="decimal-pad"
              placeholder="数量"
              placeholderTextColor={tone.muted}
              style={[styles.quantity, { color: tone.ink }]}
            />
            <Pressable
              onPress={() =>
                Alert.alert(
                  "选择单位",
                  undefined,
                  ["克", "毫升", "个", "勺", "把", "适量"].map((unit) => ({
                    text: unit,
                    onPress: () =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.map((v, i) =>
                          i === index ? { ...v, unit } : v,
                        ),
                      }),
                  })),
                )
              }
              style={[styles.unitButton, { backgroundColor: tone.accent }]}
            >
              <Text style={{ color: tone.ink }}>{item.unit}⌄</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert(
                  "食材种类",
                  undefined,
                  ingredientTypes.map((type) => ({
                    text: type,
                    onPress: () =>
                      setDraft({
                        ...draft,
                        ingredients: draft.ingredients.map((v, i) =>
                          i === index ? { ...v, type } : v,
                        ),
                      }),
                  })),
                )
              }
              style={[
                styles.ingredientTypeButton,
                { backgroundColor: tone.card, borderColor: tone.line },
              ]}
            >
              <Text style={{ color: tone.muted, fontSize: 11 }}>
                {item.type}⌄
              </Text>
            </Pressable>
            {draft.ingredients.length > 1 && (
              <Pressable
                onPress={() =>
                  setDraft({
                    ...draft,
                    ingredients: draft.ingredients.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                <Text style={[styles.inlineDelete, { color: tone.muted }]}>
                  ×
                </Text>
              </Pressable>
            )}
          </View>
        ))}
        <View style={styles.fieldHeader}>
          <Text style={[styles.fieldLabel, { color: tone.ink }]}>
            制作步骤 *
          </Text>
          <Pressable
            onPress={() =>
              setDraft({ ...draft, steps: [...draft.steps, { text: "" }] })
            }
          >
            <Text style={{ color: tone.orange, fontWeight: "800" }}>
              ＋ 添加步骤
            </Text>
          </Pressable>
        </View>
        {draft.steps.map((item, index) => (
          <View key={index} style={styles.stepRow}>
            <Text
              style={[
                styles.stepNumber,
                { backgroundColor: tone.accent, color: tone.orange },
              ]}
            >
              {index + 1}
            </Text>
            <TextInput
              value={item.text || ""}
              onChangeText={(text) =>
                setDraft({
                  ...draft,
                  steps: draft.steps.map((v, i) =>
                    i === index ? { ...v, text } : v,
                  ),
                })
              }
              placeholder="写下这一小步怎么做"
              placeholderTextColor={tone.muted}
              multiline
              style={[
                styles.stepInput,
                { color: tone.ink, borderColor: tone.line },
              ]}
            />
            {draft.steps.length > 1 && (
              <Pressable
                onPress={() =>
                  setDraft({
                    ...draft,
                    steps: draft.steps.filter((_, i) => i !== index),
                  })
                }
              >
                <Text style={[styles.inlineDelete, { color: tone.muted }]}>
                  ×
                </Text>
              </Pressable>
            )}
          </View>
        ))}
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>
          口味 · 耗时
        </Text>
        <View style={styles.fieldRow}>
          <TextInput
            value={draft.taste}
            onChangeText={(taste) => setDraft({ ...draft, taste })}
            placeholder="微辣"
            placeholderTextColor={tone.muted}
            style={[
              styles.field,
              styles.halfField,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
          <TextInput
            value={draft.time}
            onChangeText={(time) => setDraft({ ...draft, time })}
            placeholder="20 分钟"
            placeholderTextColor={tone.muted}
            style={[
              styles.field,
              styles.halfField,
              { color: tone.ink, borderColor: tone.line },
            ]}
          />
        </View>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>手账标签</Text>
        <View style={styles.draftTags}>
          {draftTagList.map((tag, index) => (
            <View
              key={tag}
              style={[
                styles.draftTag,
                {
                  backgroundColor: ["#FFF1C9", "#F8D9D3", "#DDE9D4", "#D9E7F5"][
                    index % 4
                  ],
                },
              ]}
            >
              <Text style={[styles.draftTagText, { color: tone.ink }]}>
                {tag}
              </Text>
              <Pressable onPress={() => removeDraftTag(tag)} hitSlop={8}>
                <Text style={[styles.draftTagDelete, { color: tone.muted }]}>
                  ×
                </Text>
              </Pressable>
            </View>
          ))}
          {tagAdding ? (
            <View style={styles.tagAddPanel}>
            <View style={styles.tagAddRow}>
              <TextInput
                value={tagEntry}
                onChangeText={setTagEntry}
                onSubmitEditing={addDraftTag}
                autoFocus
                returnKeyType="done"
                placeholder="例如：快手"
                placeholderTextColor={tone.muted}
                style={[
                  styles.tagAddInput,
                  {
                    color: tone.ink,
                    borderColor: tone.line,
                    backgroundColor: tone.card,
                  },
                ]}
              />
              <Pressable
                onPress={addDraftTag}
                style={[styles.tagConfirm, { backgroundColor: tone.orange }]}
              >
                <Text style={styles.spinText}>添加</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setTagEntry("");
                  setTagAdding(false);
                }}
              >
                <Text style={{ color: tone.muted, fontSize: 12 }}>取消</Text>
              </Pressable>
            </View>
            {familyTags.filter((tag) => !draftTagList.includes(tag)).length ? <View style={styles.tagReuseRow}><Text style={[styles.tagReuseLabel, { color: tone.muted }]}>复用已有：</Text>{familyTags.filter((tag) => !draftTagList.includes(tag)).map((tag, index) => <Pressable key={tag} onPress={() => setDraft({ ...draft, tags: [...draftTagList, tag].join("，") })} style={[styles.tagReuseChip, { backgroundColor: ['#FFF1C9', '#F8D9D3', '#DDE9D4', '#D9E7F5'][index % 4] }]}><Text style={{ color: tone.ink, fontSize: 12 }}>＋ {tag}</Text></Pressable>)}</View> : null}
            </View>
          ) : (
            <Pressable
              onPress={() => setTagAdding(true)}
              style={[styles.tagAddButton, { backgroundColor: tone.accent }]}
            >
              <Text style={{ color: tone.orange, fontWeight: "800" }}>
                ＋ 添加标签
              </Text>
            </Pressable>
          )}
        </View>
        <Text style={[styles.fieldLabel, { color: tone.ink }]}>小备注</Text>
        <TextInput
          value={draft.note}
          onChangeText={(note) => setDraft({ ...draft, note })}
          placeholder="留给未来的我们…"
          placeholderTextColor={tone.muted}
          style={[styles.field, { color: tone.ink, borderColor: tone.line }]}
        />
        <Pressable
          onPress={saveRecipe}
          disabled={savingRecipe}
          style={[
            styles.saveButton,
            { backgroundColor: tone.orange, opacity: savingRecipe ? 0.58 : 1 },
          ]}
        >
          <Text style={styles.spinText}>
            {savingRecipe ? "正在保存…" : "保存菜谱"}
          </Text>
        </Pressable>
        {editingId && (
          <Pressable
            onPress={() => {
              const recipe = recipeList.find((item) => item.id === editingId);
              if (recipe) deleteRecipe(recipe);
            }}
            style={styles.deleteRecipeButton}
          >
            <Text style={{ color: "#B85740", fontWeight: "800" }}>
              删除这道菜谱
            </Text>
          </Pressable>
        )}
      </View>
    </>
  );
  const Gate = () => (
    <>
    <SafeAreaView style={[styles.safe, { backgroundColor: lightTheme.paper }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.gate}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          <Text style={styles.gateCat}>CHESTNUT'S LITTLE KITCHEN</Text>
          <Text style={styles.gateTitle}>栗刻 LICO 🐈</Text>
          <Text style={styles.gateCopy}>
            {!authReady
              ? "正在连接小厨房…"
              : !session
                ? "和你爱的人一起收藏每一顿好吃的。"
                : !familyResolved
                  ? "正在找回你们的小厨房…"
                  : !familyId
                  ? "创建一个最多 3 人的家庭，或输入邀请码加入。"
                  : "正在打开你们的小厨房…"}
          </Text>
          {authReady && !session && (
            <View style={styles.gateCard}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="邮箱地址"
                placeholderTextColor="#9A8371"
                style={styles.gateInput}
              />
              <Pressable onPress={sendCode} style={styles.gateButton}>
                <Text style={styles.spinText}>发送验证码</Text>
              </Pressable>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                keyboardType="number-pad"
                placeholder="输入邮箱验证码"
                placeholderTextColor="#9A8371"
                style={styles.gateInput}
              />
              <Pressable
                onPress={verifyCode}
                style={[styles.gateButton, { backgroundColor: "#8AA07D" }]}
              >
                <Text style={styles.spinText}>验证并登录</Text>
              </Pressable>
            </View>
          )}
          {authReady && session && familyResolved && !familyId && (
            <View style={styles.gateCard}>
              <Text style={styles.gateSection}>创建我们的家庭</Text>
              <TextInput
                value={familyName}
                onChangeText={setFamilyName}
                placeholder="家庭名称"
                placeholderTextColor="#9A8371"
                style={styles.gateInput}
              />
              <Pressable onPress={createFamily} style={styles.gateButton}>
                <Text style={styles.spinText}>创建家庭</Text>
              </Pressable>
              <Text style={styles.gateDivider}>或</Text>
              <Text style={styles.gateSection}>加入另一半创建的家庭</Text>
              <TextInput
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="characters"
                placeholder="输入邀请码"
                placeholderTextColor="#9A8371"
                style={styles.gateInput}
              />
              <Pressable
                onPress={joinFamily}
                style={[styles.gateButton, { backgroundColor: "#8AA07D" }]}
              >
                <Text style={styles.spinText}>加入家庭</Text>
              </Pressable>
            </View>
          )}
          {authMessage ? (
            <Text style={styles.gateMessage}>{authMessage}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    {Sheet()}
    </>
  );
  const Sheet = () => (
    <Modal
      visible={!!sheet}
      transparent
      animationType="fade"
      onRequestClose={() => setSheet(null)}
    >
      <Pressable onPress={() => setSheet(null)} style={styles.sheetShade}>
        <Pressable
          onPress={() => undefined}
          style={[styles.sheet, { backgroundColor: tone.card }]}
        >
          <Text style={[styles.sheetCat, { color: tone.orange }]}>
            CHESTNUT'S NOTE
          </Text>
          <Text style={[styles.sheetTitle, { color: tone.ink }]}>
            {sheet?.title}
          </Text>
          {sheet?.subtitle && (
            <Text style={[styles.sheetSubtitle, { color: tone.muted }]}>
              {sheet.subtitle}
            </Text>
          )}
          {sheet?.options.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => {
                option.action();
                setSheet(null);
              }}
              style={[
                styles.sheetOption,
                {
                  backgroundColor: option.destructive ? "#F9E1D8" : tone.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: option.destructive ? "#B85740" : tone.ink,
                  fontWeight: "800",
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setSheet(null)}>
            <Text style={[styles.sheetCancel, { color: tone.muted }]}>
              取消
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
  if (!fontsLoaded) return null;
  if (!session || !familyId) return Gate();
  return (
    <ImageBackground
      source={paperBackground}
      style={styles.safe}
      imageStyle={styles.paperImage}
    >
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          {tab === "菜谱本" && !detail && !composer && !settingsOpen ? (
            Recipes()
          ) : (
          <ScrollView
            {...(detail || composer || settingsOpen
              ? recipeScreenSwipe.panHandlers
              : {})}
            onTouchEnd={() => recipeScreenTranslateX.setValue(0)}
            onTouchCancel={() => recipeScreenTranslateX.setValue(0)}
            contentContainerStyle={styles.content}
            refreshControl={
              !detail && !composer && !settingsOpen && tab !== "菜谱本" ? (
                <RefreshControl
                  refreshing={syncStatus === "正在同步…"}
                  onRefresh={retrySync}
                  tintColor={tone.orange}
                />
              ) : undefined
            }
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
          >
            <Animated.View
              style={
                detail || composer || settingsOpen
                  ? { transform: [{ translateX: recipeScreenTranslateX }] }
                  : undefined
              }
            >
              {composer
                ? Editor()
                : detail
                  ? Detail()
                  : tab === "菜谱本"
                    ? Recipes()
                    : tab === "菜单"
                      ? Menu()
                      : tab === "计时器"
                        ? Timer()
                        : settingsOpen
                          ? Settings()
                          : Profile()}
            </Animated.View>
          </ScrollView>
          )}
          {profileEditing && tab === "我的" && !settingsOpen && (
            <Pressable
              onPress={() => setProfileEditing(false)}
              style={[styles.profileCancel, { backgroundColor: tone.card }]}
            >
              <Text style={{ color: tone.muted, fontWeight: "800" }}>
                取消编辑
              </Text>
            </Pressable>
          )}
          {!detail && !composer && Nav()}
        </KeyboardAvoidingView>
        {Sheet()}
      </SafeAreaView>
    </ImageBackground>
  );
}
const lightTheme = {
  paper: "#FFF9F0",
  card: "#FFFFFF",
  ink: "#49382D",
  muted: "#9A8371",
  orange: "#C8764D",
  accent: "#F7E7CD",
  line: "#EEE0D1",
};
const darkTheme = {
  paper: "#2C211D",
  card: "#3A2C26",
  ink: "#FFE8B7",
  muted: "#C7AA8B",
  orange: "#DE996B",
  accent: "#4A392E",
  line: "#5A4438",
};
const styles: any = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 96 },
  recipeScreen: { flex: 1 },
  recipeScrollContent: { paddingBottom: 96 },
  recipeIntro: { paddingHorizontal: 20, paddingTop: 20 },
  recipeStickyFilters: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  recipeListContent: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 17,
  },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.3 },
  title: { fontSize: 29, fontWeight: "800", marginTop: 3 },
  lico: { fontSize: 14, letterSpacing: 2 },
  addButton: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  addText: { color: "#fff", fontWeight: "800" },
  catBadge: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "5deg" }],
  },
  cat: { fontSize: 27 },
  welcome: {
    padding: 18,
    minHeight: 160,
    borderRadius: 26,
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  welcomeSmall: { fontSize: 12, fontWeight: "700" },
  welcomeTitle: {
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 28,
    marginTop: 4,
  },
  catHero: { fontSize: 89, alignSelf: "flex-end", marginRight: -8 },
  spinButton: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#704B39",
    borderRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 9,
    marginTop: 11,
    transform: [{ rotate: "1deg" }],
  },
  spinText: { color: "#fffaf0", fontWeight: "800" },
  search: {
    height: 48,
    borderWidth: 1.5,
    borderRadius: 7,
    paddingHorizontal: 15,
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 13,
    shadowColor: "#8D654B",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
  },
  input: { flex: 1, marginLeft: 8, fontSize: 15 },
  categoryRow: { gap: 8, paddingBottom: 18 },
  category: { borderRadius: 15, paddingHorizontal: 14, paddingVertical: 8 },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 11,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  recipeCard: {
    borderRadius: 20,
    padding: 12,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  foodCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  foodEmoji: { fontSize: 34 },
  recipeInfo: { flex: 1, marginLeft: 12 },
  recipeName: { fontSize: 16, fontWeight: "800" },
  recipeMeta: { fontSize: 12, marginTop: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  tag: {
    backgroundColor: "#F5E6D5",
    overflow: "hidden",
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 10,
  },
  favorite: { fontSize: 27, padding: 5 },
  chevron: { fontSize: 26 },
  headerEmoji: { fontSize: 39 },
  menuHint: { fontSize: 12, marginBottom: 9 },
  menuCard: {
    borderRadius: 18,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  menuEmoji: { fontSize: 37 },
  note: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  move: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7 },
  shoppingCard: {
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#8D654B",
    padding: 17,
    marginTop: 15,
    minHeight: 210,
    transform: [{ rotate: "0.35deg" }],
    shadowColor: "#74513D",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 2, height: 3 },
  },
  shoppingText: { fontSize: 12, marginTop: 5 },
  stageChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  shoppingItem: {
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    marginTop: 13,
  },
  check: { fontSize: 20 },
  ingredient: { fontSize: 14, fontWeight: "700" },
  from: { fontSize: 10, marginTop: 2 },
  timerPage: { alignItems: "center", paddingTop: 24 },
  timerFace: {
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 10,
    marginTop: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  timerCat: { fontSize: 31 },
  timerDigits: { fontSize: 48, fontWeight: "800", marginVertical: 8 },
  wheelCard: {
    width: "100%",
    borderRadius: 20,
    marginTop: 22,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  wheelColumn: { flex: 1, alignItems: "center" },
  wheelLabel: { fontSize: 12, fontWeight: "800", marginTop: 10 },
  wheel: { width: "100%", height: 130 },
  timerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 24,
  },
  roundButton: { borderRadius: 16, padding: 12 },
  startButton: { borderRadius: 18, paddingHorizontal: 20, paddingVertical: 14 },
  timerNote: { fontSize: 12, marginTop: 25 },
  profileCard: {
    borderRadius: 20,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  familyOverview: {
    marginTop: 14,
    minHeight: 66,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    transform: [{ rotate: "0.35deg" }],
  },
  familyOverviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF9F0AA",
  },
  kitchenStats: { flexDirection: "row", gap: 8, marginTop: 9 },
  kitchenStat: {
    flex: 1,
    minHeight: 86,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  kitchenStatIcon: { width: 29, height: 29, marginBottom: 3 },
  kitchenStatValue: { fontFamily: "ZCOOLKuaiLe", fontSize: 15 },
  kitchenStatLabel: { fontFamily: "LongCang", fontSize: 13, marginTop: 2 },
  chestnutNoteCard: {
    marginTop: 15,
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    transform: [{ rotate: "0.45deg" }],
  },
  chestnutPin: { alignSelf: "flex-start", color: "#C8764D", fontSize: 18, lineHeight: 18 },
  chestnutNoteTitle: { fontFamily: "ZCOOLKuaiLe", fontSize: 13, marginBottom: 3 },
  chestnutNoteText: { fontFamily: "LongCang", fontSize: 16, lineHeight: 19 },
  chestnutNoteArrow: { fontSize: 22, fontWeight: "800" },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", fontSize: 22, color: "#C8764D" },
  familyBadge: { marginLeft: "auto", fontWeight: "800" },
  settings: { borderRadius: 20, marginTop: 12, paddingHorizontal: 15 },
  settingsEntry: {
    marginTop: 18,
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    transform: [{ rotate: "-0.3deg" }],
  },
  settingRow: {
    minHeight: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: "#EBDCCA",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingText: { fontSize: 14, fontWeight: "700" },
  chestnutNote: {
    marginTop: 23,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  noteCat: { fontSize: 42 },
  noteCopy: { fontSize: 14, fontWeight: "700", lineHeight: 21, marginLeft: 10 },
  back: { fontSize: 15, fontWeight: "800", marginBottom: 13 },
  detailHero: {
    height: 205,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 17,
  },
  detailEmoji: { fontSize: 106 },
  detailTitle: { fontSize: 29, fontWeight: "800", marginTop: 5 },
  detailBox: { borderRadius: 20, padding: 16, marginTop: 16 },
  detailStep: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
    marginTop: 12,
  },
  detailTimer: {
    borderRadius: 18,
    alignItems: "center",
    padding: 15,
    marginTop: 18,
  },
  formCard: { borderRadius: 22, padding: 16, marginTop: 16 },
  fieldHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 7,
  },
  field: {
    borderWidth: 1,
    borderRadius: 13,
    minHeight: 46,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  fieldRow: { flexDirection: "row", gap: 9 },
  halfField: { flex: 1 },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 8,
    gap: 7,
  },
  ingredientName: { flex: 1, fontSize: 14 },
  quantity: { width: 47, textAlign: "right", fontSize: 14 },
  unitButton: { borderRadius: 9, paddingHorizontal: 7, paddingVertical: 6 },
  stepRow: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "800",
    fontSize: 12,
  },
  stepInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 9,
    textAlignVertical: "top",
    fontSize: 14,
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 16,
    alignItems: "center",
    padding: 15,
  },
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 76,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
  },
  navItem: { alignItems: "center", width: 64 },
  navIcon: { fontSize: 22, lineHeight: 25 },
  navText: { fontSize: 11, marginTop: 2, fontWeight: "700" },
});

Object.assign(styles, {
  menuPurchase: {
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    transform: [{ rotate: "0.7deg" }],
  },
  shoppingViewToggle: { flexDirection: "row", gap: 8, marginTop: 12, marginBottom: 5 },
  shoppingViewChip: { borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  shoppingRecipeGroup: {
    marginTop: 9,
    paddingTop: 7,
    borderTopWidth: 1,
    borderColor: "#C8A87966",
  },
  shoppingRecipeName: {
    color: "#4A3024",
    fontFamily: "ZCOOLKuaiLe",
    fontSize: 15,
    marginBottom: 2,
  },
  shoppingCompleteNote: {
    marginTop: 9,
    marginBottom: 3,
    alignSelf: "flex-start",
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#E2EACF",
    transform: [{ rotate: "-0.7deg" }],
  },
  shoppingCompleteText: { color: "#5E704E", fontFamily: "ZCOOLKuaiLe", fontSize: 13 },
  shoppingProgress: {
    color: "#795842",
    fontFamily: "LongCang",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 2,
  },
  shoppingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  deleteRecipeButton: { alignSelf: "center", marginTop: 18, padding: 10 },
  difficultyChip: {
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  menuNoteEditor: { marginTop: 6 },
  menuNoteInput: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    fontSize: 12,
  },
  menuNoteActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
    marginTop: 6,
  },
  randomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 11,
  },
  randomTag: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#8D654B",
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
    marginTop: 11,
    transform: [{ rotate: "-2deg" }],
  },
  ingredientTypeButton: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  shoppingPaperBase: { backgroundColor: "#FFF2D6" },
  shoppingPaperImage: { borderRadius: 4, opacity: 0.34 },
  shoppingTitle: {
    color: "#4A3024",
    fontSize: 21,
    fontWeight: "800",
    fontFamily: Platform.select({ ios: "Chalkboard SE", default: undefined }),
  },
  shoppingScript: {
    color: "#795842",
    fontSize: 13,
    fontFamily: Platform.select({ ios: "Chalkboard SE", default: undefined }),
  },
  shoppingIngredient: {
    color: "#4A3024",
    fontSize: 16,
    fontWeight: "700",
    fontFamily: Platform.select({ ios: "Chalkboard SE", default: undefined }),
  },
  shoppingClear: { color: "#A94F2C", fontWeight: "800" },
  stageChipActive: { borderColor: "#A94F2C", backgroundColor: "#C86D42" },
  stageChipIdle: { borderColor: "#A98767", backgroundColor: "#F7DFA9CC" },
  shoppingChipText: { color: "#4A3024" },
  shoppingChipTextActive: { color: "#FFF6D9" },
  shoppingChecked: { color: "#A94F2C" },
  shoppingPurchased: { textDecorationLine: "line-through", opacity: 0.58 },
  shoppingCard: {
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#8D654B",
    padding: 17,
    marginTop: 15,
    minHeight: 210,
    overflow: "hidden",
    transform: [{ rotate: "0.35deg" }],
    shadowColor: "#74513D",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 2, height: 3 },
  },
  shoppingText: {
    color: "#795842",
    fontSize: 12,
    marginTop: 5,
    fontFamily: Platform.select({ ios: "Chalkboard SE", default: undefined }),
  },
  shoppingGroup: {
    color: "#795842",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 15,
    marginBottom: -3,
    letterSpacing: 0.5,
  },
  check: {
    color: "#795842",
    fontSize: 20,
    fontFamily: Platform.select({ ios: "Chalkboard SE", default: undefined }),
  },
  from: {
    color: "#795842",
    fontSize: 10,
    marginTop: 2,
    fontFamily: Platform.select({ ios: "Chalkboard SE", default: undefined }),
  },
  randomResult: { fontSize: 12, fontWeight: "800", marginTop: 8 },
  activeTagFilter: {
    alignSelf: "flex-start",
    borderRadius: 11,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: -4,
    marginBottom: 8,
  },
  filterToggle: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: "#A0765A",
    borderRadius: 3,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 10,
    transform: [{ rotate: "-1deg" }],
  },
  filterPanel: { borderRadius: 16, padding: 11, gap: 8, marginBottom: 10 },
  filterInput: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  favoriteFilter: {
    borderWidth: 1.5,
    borderColor: "#A0765A",
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    transform: [{ rotate: "1deg" }],
  },
  emptyFavorite: { textAlign: "center", fontSize: 13, paddingVertical: 22 },
  recipeCooked: { fontSize: 11, fontWeight: "800", marginTop: 4 },
  memberIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  memberAvatar: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
    overflow: "hidden",
  },
  memberAvatarImage: { width: "100%", height: "100%" },
  memberAvatarText: { fontSize: 15, fontWeight: "800" },
  memberRole: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  memberProfilePreview: {
    marginHorizontal: 10,
    marginBottom: 10,
    padding: 11,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberProfileAvatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  memberProfileAvatarImage: { width: "100%", height: "100%" },
  cookDiary: {
    borderRadius: 18,
    padding: 14,
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cookCountEditor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
  },
  cookCountInput: {
    width: 46,
    height: 34,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
    padding: 0,
  },
  cookCountValue: { fontSize: 17, fontWeight: "800" },
  cookCountStatus: { fontSize: 11, fontWeight: "700", marginLeft: 3 },
  cookButton: { borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9 },
  reviewItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 9,
  },
  reviewButton: {
    marginTop: 9,
    alignSelf: "flex-end",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  profileCancel: {
    position: "absolute",
    right: 20,
    bottom: 88,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    elevation: 2,
  },
  detailPhoto: { width: "100%", height: "100%", borderRadius: 28 },
  stepPhoto: { width: "100%", height: 150, borderRadius: 12, marginTop: 10 },
  mediaPanel: { borderRadius: 22, padding: 16, marginBottom: 12 },
  photoButton: {
    height: 132,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  coverPreview: { width: "100%", height: "100%" },
  stepImageButton: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 7,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  stepPreview: { width: "100%", height: 118 },
  stepPhotoWrap: { width: "100%", position: "relative" },
  stepPhotoLabel: {
    position: "absolute",
    left: 8,
    bottom: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  stepPhotoLabelText: { color: "#fffaf0", fontSize: 11, fontWeight: "800" },
  cardCover: { width: "100%", height: "100%", borderRadius: 20 },
  wheelCard: {
    width: "100%",
    height: 225,
    borderRadius: 20,
    marginTop: 6,
    flexDirection: "row",
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  wheel: { width: "100%", height: 195, marginTop: -7 },
  timerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 20,
  },
  cardActions: { alignItems: "flex-end", minWidth: 56 },
  cardMenu: {
    borderWidth: 1.5,
    borderColor: "#B98A5B",
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    transform: [{ rotate: "1deg" }],
  },
  cardEdit: { fontSize: 11, fontWeight: "700", marginBottom: 5 },
  menuActions: { alignItems: "flex-end", gap: 8 },
  removeText: { fontSize: 11, fontWeight: "700" },
  removePanel: { borderRadius: 18, padding: 14, marginTop: 12 },
  removeGroupTitle: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 3,
  },
  removeRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  removeButton: { fontSize: 12, fontWeight: "800", paddingLeft: 16 },
  inlineDelete: {
    fontSize: 23,
    fontWeight: "400",
    paddingLeft: 4,
    paddingRight: 2,
  },
  syncText: { fontSize: 10, marginTop: 2 },
  sortButton: {
    alignSelf: "flex-end",
    borderWidth: 1.5,
    borderColor: "#A0765A",
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: -4,
    marginBottom: 11,
    transform: [{ rotate: "-1deg" }],
  },
  menuEmpty: {
    alignItems: "center",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
  },
  menuEmptyIcon: { fontSize: 35, marginBottom: 5 },
  doneText: { fontSize: 11, fontWeight: "800" },
  diaryStrip: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 13,
    marginTop: 14,
  },
  diaryStamp: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1 },
  settingHint: { fontSize: 10, marginTop: 2 },
  chestnutHero: {
    width: 138,
    height: 145,
    alignSelf: "flex-end",
    marginRight: -15,
    marginBottom: -12,
  },
  paperImage: { opacity: 0.42 },
  tag: {
    backgroundColor: "#FFF1C9",
    borderWidth: 2,
    borderColor: "#76513E",
    borderRadius: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "700",
    shadowColor: "#7B5944",
    shadowOpacity: 0.12,
    shadowRadius: 1,
    shadowOffset: { width: 1, height: 1 },
  },
  nav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 82,
    borderTopWidth: 2,
    borderTopColor: "#76513E",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 8,
    paddingHorizontal: 10,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    width: 70,
    borderRadius: 16,
    paddingVertical: 3,
  },
  navDoodle: {
    width: 40,
    height: 33,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  navImage: { width: 34, height: 31 },
  navText: { fontSize: 10, marginTop: 3, fontWeight: "800" },
  welcome: {
    padding: 18,
    minHeight: 170,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#76513E",
    overflow: "hidden",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    shadowColor: "#7B5944",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  recipeCard: {
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: "#B08B70",
    padding: 12,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "center",
  },
  foodCircle: {
    width: 64,
    height: 64,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#76513E",
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    borderWidth: 1.5,
    borderColor: "#A0765A",
    borderRadius: 4,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  addButton: {
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#704B39",
    paddingHorizontal: 12,
    paddingVertical: 9,
    transform: [{ rotate: "1deg" }],
  },
  sheetShade: {
    flex: 1,
    backgroundColor: "rgba(48, 35, 28, 0.38)",
    justifyContent: "flex-end",
    padding: 18,
  },
  sheet: { borderRadius: 28, padding: 20, paddingBottom: 15 },
  sheetCat: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 5,
  },
  sheetSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  sheetOption: {
    borderRadius: 15,
    alignItems: "center",
    padding: 14,
    marginTop: 9,
  },
  sheetCancel: {
    textAlign: "center",
    fontWeight: "800",
    paddingTop: 17,
    paddingBottom: 3,
  },
  gate: { flexGrow: 1, justifyContent: "center", padding: 28 },
  gateCat: {
    color: "#C8764D",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
  },
  gateTitle: {
    color: "#49382D",
    fontSize: 31,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
  },
  gateCopy: {
    color: "#9A8371",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 24,
  },
  gateCard: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18 },
  gateInput: {
    backgroundColor: "#FFF9F0",
    borderColor: "#EEE0D1",
    borderWidth: 1,
    borderRadius: 14,
    color: "#49382D",
    minHeight: 50,
    paddingHorizontal: 13,
    marginBottom: 10,
  },
});

Object.assign(styles, {
  // Hand-drawn feeling comes from small rotations and paper shadows; keep strokes clean on mobile screens.
  addButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    transform: [{ rotate: "1deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  spinButton: {
    alignSelf: "flex-start",
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 11,
    transform: [{ rotate: "1deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  randomTag: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
    marginTop: 11,
    transform: [{ rotate: "-2deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  category: {
    borderRadius: 10,
    borderTopWidth: 4,
    borderTopColor: "#F1D3A0",
    paddingHorizontal: 13,
    paddingVertical: 7,
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
  },
  filterToggle: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 10,
    transform: [{ rotate: "-1deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  favoriteFilter: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    transform: [{ rotate: "1deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
  },
  sortButton: {
    alignSelf: "flex-end",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: -4,
    marginBottom: 11,
    transform: [{ rotate: "-1deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
  },
  cardMenu: {
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginBottom: 8,
    transform: [{ rotate: "1deg" }],
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 1 },
  },
  move: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    transform: [{ rotate: "-1deg" }],
  },
  roundButton: {
    borderRadius: 11,
    padding: 12,
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  startButton: {
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#704B39",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 12,
    alignItems: "center",
    padding: 15,
    shadowColor: "#704B39",
    shadowOpacity: 0.18,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  reviewButton: {
    marginTop: 9,
    alignSelf: "flex-end",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gateButton: {
    backgroundColor: "#C8764D",
    borderRadius: 12,
    alignItems: "center",
    padding: 14,
    marginBottom: 14,
    shadowColor: "#704B39",
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 2, height: 2 },
  },
  sheetOption: {
    borderRadius: 12,
    alignItems: "center",
    padding: 14,
    marginTop: 9,
  },
  diaryStrip: {
    borderWidth: 1,
    borderColor: "#B08B70",
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
  },
  title: {
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "normal",
    fontSize: 29,
    marginTop: 3,
  },
  addText: { color: "#fff", fontFamily: "ZCOOLKuaiLe", fontWeight: "normal" },
  spinText: {
    color: "#fffaf0",
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "normal",
  },
  recipeName: { fontFamily: "ZCOOLKuaiLe", fontWeight: "normal", fontSize: 17 },
  shoppingTitle: {
    color: "#4A3024",
    fontFamily: "LongCang",
    fontSize: 30,
    lineHeight: 34,
  },
  shoppingScript: {
    color: "#795842",
    fontFamily: "LongCang",
    fontSize: 20,
    lineHeight: 23,
  },
  shoppingIngredient: {
    color: "#4A3024",
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "normal",
    fontSize: 17,
  },
  shoppingText: {
    color: "#795842",
    fontFamily: "LongCang",
    fontSize: 20,
    marginTop: 5,
  },
  shoppingGroup: {
    color: "#795842",
    fontFamily: "LongCang",
    fontSize: 19,
    marginTop: 15,
    marginBottom: -3,
  },
  from: {
    color: "#795842",
    fontFamily: "LongCang",
    fontSize: 15,
    marginTop: 2,
  },
  tagSticker: { position: "relative", paddingTop: 4 },
  tagPin: {
    position: "absolute",
    zIndex: 2,
    top: 1,
    left: "50%",
    width: 7,
    height: 7,
    marginLeft: -3.5,
    borderRadius: 4,
    shadowColor: "#4A3024",
    shadowOpacity: 0.28,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
  },
  categoryText: {
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "normal",
    fontSize: 14,
    letterSpacing: 0.2,
  },
  categoryScroller: { marginBottom: 12 },
  categoryScrollHint: {
    height: 16,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryScrollThumb: { width: 44, height: 3, borderRadius: 3, opacity: 0.55 },
  categoryScrollText: {
    position: "absolute",
    right: 2,
    top: 1,
    fontSize: 9,
    fontFamily: "LongCang",
  },
  timerPage: { alignItems: "center", paddingTop: 18 },
  timerNotePaper: {
    width: "100%",
    borderRadius: 14,
    paddingHorizontal: 17,
    paddingTop: 21,
    paddingBottom: 15,
    marginTop: 15,
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 2, height: 3 },
    transform: [{ rotate: "-0.35deg" }],
  },
  timerTape: {
    position: "absolute",
    top: -8,
    alignSelf: "center",
    backgroundColor: "#F5D89E",
    paddingHorizontal: 19,
    paddingVertical: 4,
    borderRadius: 3,
    transform: [{ rotate: "1deg" }],
  },
  timerTapeText: {
    color: "#76513E",
    fontFamily: "ZCOOLKuaiLe",
    fontSize: 11,
    letterSpacing: 1,
  },
  timerTask: { fontFamily: "ZCOOLKuaiLe", fontSize: 16, marginBottom: 10 },
  timerDisplay: {
    minHeight: 176,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#704B39",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  timerCat: { fontSize: 27, marginBottom: 2 },
  timerDigits: {
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "normal",
    fontSize: 52,
    letterSpacing: 1,
    marginVertical: 3,
  },
  timerHint: { fontFamily: "LongCang", fontSize: 18 },
  timerMarginNote: {
    fontFamily: "LongCang",
    fontSize: 18,
    marginTop: 11,
    alignSelf: "flex-end",
  },
  wheelCard: {
    width: "100%",
    height: 210,
    borderRadius: 13,
    marginTop: 16,
    flexDirection: "row",
    paddingHorizontal: 12,
    overflow: "hidden",
    shadowColor: "#704B39",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  webTimerCard: {
    width: "100%",
    height: 190,
    borderRadius: 13,
    marginTop: 16,
    flexDirection: "row",
    padding: 13,
    gap: 12,
    shadowColor: "#704B39",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  webWheel: { width: "100%", height: 126, marginTop: 2 },
  webWheelContent: { paddingVertical: 42 },
  webWheelItem: {
    height: 42,
    lineHeight: 42,
    textAlign: "center",
    fontFamily: "ZCOOLKuaiLe",
    fontSize: 24,
  },
  webWheelSelection: {
    position: "absolute",
    top: 66,
    left: 3,
    right: 3,
    height: 42,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: 7,
    backgroundColor: "rgba(247, 231, 205, 0.28)",
  },
  wheelDivider: { width: 1, backgroundColor: "#E8D8C5", marginVertical: 29 },
  timerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  stageChip: {
    borderWidth: 0,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: "#704B39",
    shadowOpacity: 0.1,
    shadowRadius: 1,
    shadowOffset: { width: 1, height: 1 },
  },
  stageChipActive: {
    backgroundColor: "#C86D42",
    shadowColor: "#704B39",
    shadowOpacity: 0.16,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  stageChipIdle: {
    backgroundColor: "#F7DFA9E0",
    shadowColor: "#A98767",
    shadowOpacity: 0.11,
    shadowRadius: 1,
    shadowOffset: { width: 1, height: 1 },
  },
  gateSection: {
    color: "#49382D",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  gateDivider: {
    color: "#9A8371",
    textAlign: "center",
    fontWeight: "800",
    marginBottom: 14,
  },
  gateMessage: {
    color: "#9A8371",
    fontSize: 12,
    textAlign: "center",
    marginTop: 16,
  },
});

Object.assign(styles, {
  // A softer edge keeps the shopping list feeling like paper, not a framed card.
  shoppingCard: {
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#C9A77D",
    padding: 17,
    marginTop: 15,
    minHeight: 210,
    overflow: "hidden",
    transform: [{ rotate: "0.35deg" }],
    shadowColor: "#74513D",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 2, height: 3 },
  },
  shoppingTape: {
    position: "absolute",
    zIndex: 4,
    top: -5,
    width: 76,
    height: 24,
    backgroundColor: "rgba(255, 249, 224, 0.56)",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(151, 120, 75, 0.18)",
    shadowColor: "#6C4932",
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 1, height: 2 },
  },
  shoppingTapeLeft: { left: 21, transform: [{ rotate: "-8deg" }] },
  shoppingTapeRight: { right: 20, transform: [{ rotate: "7deg" }] },
  shoppingTear: {
    position: "absolute",
    zIndex: 3,
    width: 24,
    height: 11,
    borderRadius: 12,
    backgroundColor: "#FFF9F0",
    opacity: 0.96,
  },
  shoppingTearTop: { top: -6, left: "48%", transform: [{ rotate: "8deg" }] },
  shoppingTearBottom: {
    bottom: -6,
    left: "31%",
    transform: [{ rotate: "-7deg" }],
  },
  handCheck: {
    width: 18,
    height: 18,
    marginLeft: 1,
    borderWidth: 1.5,
    borderColor: "#9B785A",
    borderRadius: 2,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-1deg" }],
  },
  handCheckDone: { backgroundColor: "rgba(255, 238, 184, 0.56)" },
  handCheckGlyph: {
    color: "#7C513B",
    fontFamily: "ZCOOLKuaiLe",
    fontSize: 17,
    lineHeight: 19,
    marginTop: -1,
    transform: [{ rotate: "-8deg" }],
  },
});

Object.assign(styles, {
  draftTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
    marginTop: 2,
  },
  draftTag: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: "#704B39",
    shadowOpacity: 0.08,
    shadowRadius: 1,
    shadowOffset: { width: 1, height: 1 },
  },
  draftTagText: {
    fontFamily: "ZCOOLKuaiLe",
    fontWeight: "normal",
    fontSize: 13,
  },
  draftTagDelete: { fontSize: 17, marginLeft: 5, lineHeight: 18 },
  tagAddButton: {
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    transform: [{ rotate: "-1deg" }],
  },
  tagAddRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  tagAddPanel: { width: '100%', gap: 9 },
  tagReuseRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  tagReuseLabel: { fontFamily: 'LongCang', fontSize: 16, marginRight: 1 },
  tagReuseChip: { borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5, transform: [{ rotate: '-0.5deg' }] },
  tagAddInput: {
    flex: 1,
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  tagConfirm: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: 9 },
});

Object.assign(styles, {
  headerDoodle: {
    width: 52,
    height: 52,
    resizeMode: "contain",
    marginRight: -2,
  },
  shoppingTitleRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  shoppingTitleDoodle: {
    width: 34,
    height: 34,
    resizeMode: "contain",
    marginLeft: -2,
  },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  detailAction: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, transform: [{ rotate: '-0.5deg' }] },
  emptyDiary: { marginTop: 8, borderRadius: 16, padding: 18, alignItems: 'center' },
  emptyChestnut: { width: 78, height: 76, marginBottom: 4 },
  tagLibraryTitle: { marginTop: 13, fontFamily: 'ZCOOLKuaiLe', fontSize: 14 },
  tagLibrary: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 8 },
  libraryTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 },
  quickTimerRow: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 13 },
  quickTimer: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 9, transform: [{ rotate: '-0.5deg' }] },
  timerDoneCard: { width: '100%', marginTop: 14, borderWidth: 1, borderRadius: 13, padding: 13, alignItems: 'center' },
  timerDoneButton: { marginTop: 9, paddingHorizontal: 13, paddingVertical: 9, borderRadius: 10 },
  recentSection: { marginTop: 14 },
  recentTitle: { fontFamily: 'ZCOOLKuaiLe', fontSize: 15, marginBottom: 7 },
  recentRow: { gap: 9, paddingRight: 6 },
  recentCard: { width: 105, borderWidth: 1, borderRadius: 12, padding: 9, transform: [{ rotate: '-0.5deg' }] },
  recentEmoji: { fontSize: 24, marginBottom: 4 },
  recentName: { fontFamily: 'ZCOOLKuaiLe', fontSize: 12 },
});
