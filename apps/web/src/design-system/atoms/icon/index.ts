/**
 * Icon atom — the project's single source for icons.
 *
 * We re-export the exact Lucide icons the app uses (rather than importing from
 * `lucide-react` directly at call sites) so there is ONE place that defines the
 * allowed icon set and we can swap the underlying library later without touching
 * any consumer. Browse/search the full set at https://lucide.dev.
 *
 * Usage — they are plain SVG components; size and colour them with Tailwind and
 * mark decorative ones `aria-hidden` (the surrounding control carries the label):
 *   import { Mail } from '@/design-system/atoms/icon';
 *   <Mail className="h-5 w-5 text-muted-foreground" aria-hidden />
 *
 * Keep this list curated — add an icon here only when a component needs it.
 */
export {
  Award,
  BarChart3,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  Flag,
  GraduationCap,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Moon,
  Pencil,
  Phone,
  Plus,
  Sun,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
