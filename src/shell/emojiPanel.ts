/**
 * 이모지 패널 (Win+. / Win+;). Windows puts one behind those two chords and
 * the shell had neither. The list, the search and the recents live here so
 * the panel itself is only markup.
 */
export type EmojiEntry = {
  /** What is typed into the field. */
  char: string;
  /** Korean keywords the search matches on, name first. */
  keywords: string[];
};

export type EmojiGroup = {
  emoji: EmojiEntry[];
  id: string;
  label: string;
};

export const EMOJI_RECENT_LIMIT = 16;

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    id: "smileys",
    label: "표정",
    emoji: [
      { char: "😀", keywords: ["웃음", "미소", "기쁨"] },
      { char: "😂", keywords: ["눈물", "웃음", "폭소"] },
      { char: "🙂", keywords: ["미소", "살짝"] },
      { char: "😍", keywords: ["하트", "사랑", "반함"] },
      { char: "😎", keywords: ["선글라스", "멋짐"] },
      { char: "🤔", keywords: ["생각", "고민"] },
      { char: "😴", keywords: ["잠", "졸림"] },
      { char: "😭", keywords: ["울음", "눈물"] },
      { char: "😅", keywords: ["식은땀", "민망"] },
      { char: "🥳", keywords: ["축하", "파티"] },
      { char: "😡", keywords: ["화남", "분노"] },
      { char: "🤯", keywords: ["놀람", "충격"] },
    ],
  },
  {
    id: "people",
    label: "사람",
    emoji: [
      { char: "👍", keywords: ["좋아요", "엄지"] },
      { char: "👎", keywords: ["싫어요", "엄지"] },
      { char: "👏", keywords: ["박수", "칭찬"] },
      { char: "🙏", keywords: ["부탁", "감사", "기도"] },
      { char: "🙌", keywords: ["만세", "환호"] },
      { char: "💪", keywords: ["힘", "근육", "화이팅"] },
      { char: "🤝", keywords: ["악수", "협력"] },
      { char: "👋", keywords: ["인사", "안녕"] },
      { char: "🫡", keywords: ["경례", "알겠습니다"] },
      { char: "👀", keywords: ["눈", "보기"] },
    ],
  },
  {
    id: "nature",
    label: "자연",
    emoji: [
      { char: "🐱", keywords: ["고양이", "야옹"] },
      { char: "🐶", keywords: ["강아지", "멍멍"] },
      { char: "🐻", keywords: ["곰"] },
      { char: "🌱", keywords: ["새싹", "식물"] },
      { char: "🌸", keywords: ["벚꽃", "꽃"] },
      { char: "🌞", keywords: ["해", "맑음"] },
      { char: "🌧️", keywords: ["비", "흐림"] },
      { char: "⛄", keywords: ["눈사람", "겨울"] },
      { char: "🔥", keywords: ["불", "인기"] },
      { char: "⭐", keywords: ["별", "즐겨찾기"] },
    ],
  },
  {
    id: "food",
    label: "음식",
    emoji: [
      { char: "☕", keywords: ["커피", "카페"] },
      { char: "🍚", keywords: ["밥", "식사"] },
      { char: "🍜", keywords: ["라면", "국수"] },
      { char: "🍕", keywords: ["피자"] },
      { char: "🍗", keywords: ["치킨", "닭"] },
      { char: "🍰", keywords: ["케이크", "디저트"] },
      { char: "🍺", keywords: ["맥주", "술"] },
      { char: "🍉", keywords: ["수박", "과일"] },
    ],
  },
  {
    id: "objects",
    label: "사물",
    emoji: [
      { char: "💻", keywords: ["노트북", "컴퓨터", "개발"] },
      { char: "🖱️", keywords: ["마우스"] },
      { char: "⌨️", keywords: ["키보드"] },
      { char: "📁", keywords: ["폴더", "파일"] },
      { char: "📝", keywords: ["메모", "기록"] },
      { char: "📌", keywords: ["고정", "핀"] },
      { char: "🔍", keywords: ["검색", "돋보기"] },
      { char: "⏰", keywords: ["알람", "시계"] },
      { char: "🗑️", keywords: ["휴지통", "삭제"] },
      { char: "🎉", keywords: ["축하", "파티"] },
    ],
  },
  {
    id: "symbols",
    label: "기호",
    emoji: [
      { char: "✅", keywords: ["완료", "체크"] },
      { char: "❌", keywords: ["취소", "엑스"] },
      { char: "⚠️", keywords: ["경고", "주의"] },
      { char: "❤️", keywords: ["하트", "사랑"] },
      { char: "💡", keywords: ["아이디어", "전구"] },
      { char: "🔗", keywords: ["링크", "연결"] },
      { char: "➡️", keywords: ["화살표", "오른쪽"] },
      { char: "🔄", keywords: ["새로 고침", "반복"] },
    ],
  },
];

const ALL_EMOJI = EMOJI_GROUPS.flatMap((group) =>
  group.emoji.map((entry) => ({ ...entry, groupLabel: group.label })),
);

/**
 * Search runs over the keywords and the group's own name, so 표정 finds the
 * faces and 휴지통 finds the bin. An empty query means the whole list.
 */
export function searchEmoji(query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return ALL_EMOJI.map((entry) => entry.char);
  return ALL_EMOJI.filter(
    (entry) =>
      entry.char === needle ||
      entry.groupLabel.toLowerCase().includes(needle) ||
      entry.keywords.some((keyword) => keyword.toLowerCase().includes(needle)),
  ).map((entry) => entry.char);
}

export function getEmojiKeywords(char: string) {
  return ALL_EMOJI.find((entry) => entry.char === char)?.keywords ?? [];
}

/** 최근 사용, newest first, each emoji listed once. */
export function pushRecentEmoji(recent: string[], char: string) {
  return [char, ...recent.filter((entry) => entry !== char)].slice(0, EMOJI_RECENT_LIMIT);
}
