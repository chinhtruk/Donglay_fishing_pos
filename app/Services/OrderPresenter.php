<?php

namespace App\Services;

use App\Models\Order;

class OrderPresenter
{
    public static function make(Order $order): array
    {
        $order->loadMissing(['items', 'payments.lines.orderItem', 'coffeeTable', 'fishingSpot', 'fishingSession', 'opener:id,name']);

        return [
            'id' => $order->id,
            'order_number' => self::shortNumber($order->order_number),
            'service_type' => $order->service_type,
            'status' => $order->status,
            'version' => $order->version,
            'subtotal' => $order->subtotal,
            'total' => $order->total,
            'opened_at' => $order->created_at?->toIso8601String(),
            'activity_at' => $order->updated_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'resource' => $order->coffeeTable ?? $order->fishingSpot,
            'fishing_session' => $order->fishingSession ? [
                'id' => $order->fishingSession->id,
                'status' => $order->fishingSession->status,
                'started_at' => $order->fishingSession->started_at->toIso8601String(),
                'ends_at' => $order->fishingSession->ends_at->toIso8601String(),
                'blocks_count' => $order->fishingSession->blocks_count,
            ] : null,
            'items' => $order->items->map(fn ($item) => [
                'id' => $item->id,
                'menu_item_id' => $item->menu_item_id,
                'line_type' => $item->line_type,
                'name' => $item->name_snapshot,
                'unit_price' => $item->unit_price,
                'quantity' => $item->quantity,
                'paid_quantity' => $item->paid_quantity,
                'unpaid_quantity' => $item->quantity - $item->paid_quantity,
                'note' => $item->note,
                'line_total' => number_format((float) $item->unit_price * $item->quantity, 2, '.', ''),
            ])->values(),
            'payments' => $order->payments->map(fn ($payment) => [
                'id' => $payment->id,
                'payment_number' => $payment->payment_number,
                'method' => $payment->method,
                'amount' => $payment->amount,
                'cash_received' => $payment->cash_received,
                'change_due' => $payment->change_due,
                'status' => $payment->status,
                'paid_at' => $payment->paid_at->toIso8601String(),
                'lines' => $payment->lines->map(fn ($line) => [
                    'id' => $line->id,
                    'order_item_id' => $line->order_item_id,
                    'quantity' => $line->quantity,
                    'unit_price' => $line->unit_price,
                    'amount' => $line->amount,
                    'name' => $line->orderItem?->name_snapshot ?? 'Món đã xóa',
                ])->values(),
            ])->values(),
        ];
    }

    private static function shortNumber(string $number): string
    {
        $parts = explode('-', $number);

        return count($parts) >= 3
            ? $parts[0].'-'.$parts[array_key_last($parts)]
            : $number;
    }
}
