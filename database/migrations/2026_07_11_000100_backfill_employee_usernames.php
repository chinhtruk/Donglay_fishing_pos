<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')
            ->where('role', 'employee')
            ->orderBy('id')
            ->get(['id', 'username', 'email'])
            ->each(function (object $user): void {
                $source = trim((string) ($user->username ?: Str::before((string) $user->email, '@')));
                $base = Str::lower(Str::ascii($source));
                $base = trim((string) preg_replace('/[^a-z0-9._-]+/', '-', $base), '._-');
                $base = Str::limit($base ?: 'nhanvien-'.$user->id, 80, '');
                $candidate = $base;
                $suffix = 1;

                while (DB::table('users')->where('username', $candidate)->where('id', '!=', $user->id)->exists()) {
                    $tail = '-'.($suffix++);
                    $candidate = Str::limit($base, 80 - strlen($tail), '').$tail;
                }

                if ($candidate !== $user->username) {
                    DB::table('users')->where('id', $user->id)->update(['username' => $candidate]);
                }
            });
    }

    public function down(): void
    {
        // Generated usernames cannot be distinguished safely from user-assigned values.
    }
};
