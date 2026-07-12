<?php

namespace App\Services;

use App\Mail\DatabaseBackupMail;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

class AdminDataManagementService
{
    public const RESET_FLAG = 'admin_data_reset_in_progress';

    public function __construct(private readonly DatabaseDumpWriter $dumpWriter) {}

    public function backup(User $admin): string
    {
        return Cache::lock('admin-database-backup', 600)->block(5, function () use ($admin): string {
            $this->sendBackup($admin, false);

            return $admin->email;
        });
    }

    public function backupAndClearOperationalData(User $admin): array
    {
        return Cache::lock('admin-database-backup', 600)->block(5, function () use ($admin): array {
            Cache::put(self::RESET_FLAG, true, now()->addMinutes(10));

            try {
                $this->sendBackup($admin, true);

                return DB::transaction(function (): array {
                    $deleted = [];
                    foreach (config('data-management.operational_tables', []) as $table) {
                        $deleted[$table] = DB::table($table)->delete();
                    }

                    return $deleted;
                });
            } finally {
                Cache::forget(self::RESET_FLAG);
            }
        });
    }

    private function sendBackup(User $admin, bool $beforeReset): void
    {
        if ($admin->role !== 'admin' || ! filter_var($admin->email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages([
                'email' => 'Tài khoản admin đang đăng nhập chưa có email nhận sao lưu hợp lệ.',
            ]);
        }

        $backupPath = $this->dumpWriter->createSqlDump();
        $backupName = 'donglay-fishing-'.now()->format('Ymd-His').'.sql';

        try {
            Mail::to($admin->email)->send(new DatabaseBackupMail($backupPath, $backupName, $beforeReset));
        } finally {
            @unlink($backupPath);
        }
    }
}
