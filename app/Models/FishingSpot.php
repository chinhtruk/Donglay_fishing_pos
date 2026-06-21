<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FishingSpot extends Model
{
    protected $fillable = ['label', 'position_x', 'position_y', 'is_enabled'];

    protected function casts(): array
    {
        return ['position_x' => 'decimal:2', 'position_y' => 'decimal:2', 'is_enabled' => 'boolean'];
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(FishingSession::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }
}
