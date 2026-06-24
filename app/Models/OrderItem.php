<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrderItem extends Model
{
    protected $fillable = ['order_id', 'menu_item_id', 'line_type', 'name_snapshot', 'unit_price', 'quantity', 'paid_quantity', 'ordered_at', 'note'];

    protected function casts(): array
    {
        return [
            'unit_price' => 'decimal:2',
            'ordered_at' => 'datetime',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function menuItem(): BelongsTo
    {
        return $this->belongsTo(MenuItem::class)->withTrashed();
    }

    public function paymentLines(): HasMany
    {
        return $this->hasMany(PaymentLine::class);
    }
}
