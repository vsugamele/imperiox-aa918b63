import {
  BadgeCheck, BarChart3, BookOpen, Bot, Building2, Calendar, CalendarClock, CircleDashed, Clapperboard, CreditCard,
  Crosshair, Database, Facebook, FileText, Film, Gift, GitFork, Globe, GraduationCap, Hourglass, Image, Instagram,
  LifeBuoy, Linkedin, ListChecks, Mail, Megaphone, MessageCircle, MessageSquare, MessageSquareReply, MessagesSquare,
  MousePointerClick, Music2, Newspaper, PackagePlus, PartyPopper, Phone, PlayCircle, Plug, Presentation, QrCode,
  Radio, Receipt, Repeat, RotateCcw, Search, Send, ShoppingCart, Smartphone, Sparkles, Sprout, Tag, Target, Triangle,
  TrendingDown, TrendingUp, Twitter, Undo2, UserCheck, UserPlus, Users, Workflow, Wrench, XCircle, Youtube, Zap,
  type LucideIcon,
} from "lucide-react";
import { ELEMENT_FAMILIES, MAP_ELEMENTS, type ElementFamily } from "@shared/map-elements";

const ICONS: Record<string, LucideIcon> = {
  BadgeCheck, BarChart3, BookOpen, Bot, Building2, Calendar, CalendarClock, CircleDashed, Clapperboard, CreditCard,
  Crosshair, Database, Facebook, FileText, Film, Gift, GitFork, Globe, GraduationCap, Hourglass, Image, Instagram,
  LifeBuoy, Linkedin, ListChecks, Mail, Megaphone, MessageCircle, MessageSquare, MessageSquareReply, MessagesSquare,
  MousePointerClick, Music2, Newspaper, PackagePlus, PartyPopper, Phone, PlayCircle, Plug, Presentation, QrCode,
  Radio, Receipt, Repeat, RotateCcw, Search, Send, ShoppingCart, Smartphone, Sparkles, Sprout, Tag, Target, Triangle,
  TrendingDown, TrendingUp, Twitter, Undo2, UserCheck, UserPlus, Users, Workflow, Wrench, XCircle, Youtube, Zap,
};

const FAMILY_FALLBACK_ICON: Record<ElementFamily, LucideIcon> = {
  estrutura: Building2, trafego: Megaphone, paginas: Globe, ofertas: ShoppingCart,
  acoes: Zap, comunicacao: MessageCircle, integracoes: Plug, midia: Image,
};

export interface KindPreset { label: string; color: string; icon: LucideIcon }

/** Rótulo, cor e ícone de cada tipo de elemento, derivados do catálogo compartilhado. */
export const KIND_PRESETS: Record<string, KindPreset> = Object.fromEntries(
  MAP_ELEMENTS.map((e) => [e.key, { label: e.label, color: e.color, icon: ICONS[e.icon] ?? FAMILY_FALLBACK_ICON[e.family] }]),
);

/** Tipos agrupados por família, na ordem da paleta. */
export const KIND_CATEGORIES: Array<{ family: ElementFamily; label: string; keys: string[] }> = ELEMENT_FAMILIES.map((f) => ({
  family: f.key,
  label: f.label,
  keys: MAP_ELEMENTS.filter((e) => e.family === f.key).map((e) => e.key),
}));

export const KIND_COLORS: Record<string, string> = Object.fromEntries(MAP_ELEMENTS.map((e) => [e.key, e.color]));
