import {
  IconBus,
  IconCoffee,
  IconDots,
  IconFileInvoice,
  IconHeart,
  IconShoppingBag,
  IconShoppingCart,
  type Icon,
} from '@tabler/icons-react'

// Only the icons categories can use are imported, to keep the bundle small.
const ICONS: Record<string, Icon> = {
  'shopping-cart': IconShoppingCart,
  bus: IconBus,
  'file-invoice': IconFileInvoice,
  coffee: IconCoffee,
  heart: IconHeart,
  'shopping-bag': IconShoppingBag,
  dots: IconDots,
}

export function CategoryIcon({ name }: { name: string | undefined }) {
  const Icon = (name && ICONS[name]) || IconDots
  return (
    <span className="flex size-9 flex-none items-center justify-center rounded-control bg-brand-50 text-brand-800">
      <Icon size={18} stroke={1.75} aria-hidden="true" />
    </span>
  )
}
