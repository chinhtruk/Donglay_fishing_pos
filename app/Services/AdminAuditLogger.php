<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class AdminAuditLogger
{
    public function record(User $user, string $action, object $model, ?array $before, ?array $after, ?string $reason = null): void
    {
        DB::table('audit_logs')->insert([
            'user_id' => $user->id,
            'action' => $action,
            'auditable_type' => $model::class,
            'auditable_id' => $model->id,
            'before' => $before ? json_encode($before) : null,
            'after' => $after ? json_encode($after) : null,
            'reason' => $reason,
            'created_at' => now(),
        ]);
    }
}
