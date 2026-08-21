<?php

namespace App\Services;

use App\Models\MenuItem;
use App\Models\Order;
use Illuminate\Validation\ValidationException;

class OrderLineReconciler
{
    public function replaceMenuLines(Order $order, array $lines, bool $allowEmpty = false): void
    {
        if ($lines === [] && ! $allowEmpty) {
            throw ValidationException::withMessages(['items' => 'Bạn chọn ít nhất một món để mở đơn nhé.']);
        }

        $orderedAt = now();
        $requested = collect($lines)->map(function (array $line) {
            $line['menu_item_id'] = (int) $line['menu_item_id'];
            $line['unit_price'] = (int) ($line['unit_price'] ?? 0);

            return $line;
        });

        $menu = collect();
        if ($requested->isNotEmpty()) {
            $menu = MenuItem::query()
                ->whereIn('id', $requested->pluck('menu_item_id'))
                ->where('is_available', true)
                ->get()
                ->keyBy('id');

            if ($menu->count() !== $requested->pluck('menu_item_id')->unique()->count() || $requested->contains(fn (array $line) => (int) $line['quantity'] < 1 || (int) $line['quantity'] > 99)) {
                throw ValidationException::withMessages(['items' => 'Có món vừa hết hoặc số lượng chưa phù hợp. Bạn chọn lại giúp mình nhé.']);
            }
        }

        $requested = $requested->map(function (array $line) use ($menu) {
            $product = $menu->get($line['menu_item_id']);
            $line['unit_price'] = (int) $product->price === 0 ? (int) $line['unit_price'] : (int) $product->price;

            return $line;
        })->keyBy(fn (array $line) => $this->lineKey($line['menu_item_id'], $line['unit_price']));

        $existing = $order->items()
            ->where('line_type', 'menu')
            ->get()
            ->groupBy(fn ($item) => $this->lineKey($item->menu_item_id, $item->unit_price));

        foreach ($existing as $key => $items) {
            $lineData = $requested->get($key);
            $desired = $lineData ? (int) $lineData['quantity'] : 0;
            $paidTotal = (int) $items->sum('paid_quantity');
            $currentTotal = (int) $items->sum('quantity');

            if ($desired < $paidTotal) {
                throw ValidationException::withMessages(['items' => 'Món đã thanh toán sẽ được giữ nguyên; bạn có thể chỉnh phần chưa thanh toán nhé.']);
            }

            if ($desired === 0) {
                $items->each->delete();
                continue;
            }

            $items = $items
                ->sortBy(fn ($item) => sprintf('%012d-%012d', $item->ordered_at?->timestamp ?? $item->created_at?->timestamp ?? 0, $item->id))
                ->values();
            $note = $lineData['note'] ?? null;

            if ($desired > $currentTotal) {
                $items->each(fn ($item) => $item->update(['note' => $note]));
                $product = $menu->get($lineData['menu_item_id']);
                $unitPrice = (int) $product->price === 0 ? (int) $lineData['unit_price'] : (int) $product->price;
                $order->items()->create([
                    'menu_item_id' => $product->id,
                    'line_type' => 'menu',
                    'name_snapshot' => $product->name,
                    'unit_price' => $unitPrice,
                    'quantity' => $desired - $currentTotal,
                    'ordered_at' => $orderedAt,
                    'note' => $note,
                ]);
                continue;
            }

            $remainingExtra = $desired - $paidTotal;
            foreach ($items as $item) {
                $paid = (int) $item->paid_quantity;
                $extra = min((int) $item->quantity - $paid, $remainingExtra);
                $quantity = $paid + $extra;
                $remainingExtra -= $extra;

                if ($quantity <= 0) {
                    $item->delete();
                } else {
                    $item->update(['quantity' => $quantity, 'note' => $note]);
                }
            }
        }

        foreach ($requested as $key => $lineData) {
            if ($existing->has($key)) {
                continue;
            }

            $product = $menu->get($lineData['menu_item_id']);
            $unitPrice = (int) $product->price === 0 ? (int) $lineData['unit_price'] : (int) $product->price;
            $order->items()->create([
                'menu_item_id' => $product->id,
                'line_type' => 'menu',
                'name_snapshot' => $product->name,
                'unit_price' => $unitPrice,
                'quantity' => (int) $lineData['quantity'],
                'ordered_at' => $orderedAt,
                'note' => $lineData['note'] ?? null,
            ]);
        }
    }

    private function lineKey(int|string|null $menuItemId, int|string $unitPrice): string
    {
        return ((int) $menuItemId).'-'.((int) $unitPrice);
    }
}
