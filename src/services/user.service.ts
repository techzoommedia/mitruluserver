import { IUserRepository, userRepository } from '../repositories/user.repository';

export interface ICircleActiveUser {
  id: string;
  _id?: string;
  name: string;
  teluguName?: string;
  handle: string;
  mitraId?: string;
  avatar: string;
  bio?: string;
  teluguBio?: string;
  location: string;
  isVerified: boolean;
  gender: string;
  profession: string;
  callCategory: string;
  isCallActive: boolean;
  callLanguage: string;
  callRating: number;
  callRatingCount: number;
  callRateCoins: number;
  isOnline: boolean;
  callActiveAt?: number;
}

export class UserService {
  private userRepo: IUserRepository;
  private activeUsersCache = new Map<string, ICircleActiveUser>();

  constructor(userRepo: IUserRepository = userRepository) {
    this.userRepo = userRepo;
  }

  getCacheSize(): number {
    return this.activeUsersCache.size;
  }

  getCachedActiveUsersList(): ICircleActiveUser[] {
    return Array.from(this.activeUsersCache.values()).sort(
      (a, b) => (b.callActiveAt || 0) - (a.callActiveAt || 0) || b.callRating - a.callRating
    );
  }

  async syncActiveUsersFromDB(): Promise<void> {
    try {
      const users = await this.userRepo.findActiveUsers();
      this.activeUsersCache.clear();
      for (const u of users) {
        const id = u._id.toString();
        this.activeUsersCache.set(id, {
          id,
          _id: id,
          name: u.name,
          teluguName: u.teluguName || u.name,
          handle: u.mitraId || u.handle,
          mitraId: u.mitraId || u.handle,
          avatar: u.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
          bio: u.bio || '',
          teluguBio: u.teluguBio || '',
          location: u.location || 'హైదరాబాద్, తెలంగాణ',
          isVerified: Boolean(u.isVerified),
          gender: u.gender || 'prefer_not_to_say',
          profession: u.profession || 'కమ్యూనిటీ మిత్రులు',
          callCategory: u.callCategory || 'casuals',
          isCallActive: true,
          callLanguage: u.callLanguage || 'తెలుగు (Telugu)',
          callRating: u.callRating ?? 5.0,
          callRatingCount: u.callRatingCount ?? 0,
          callRateCoins: u.callRateCoins ?? 500,
          isOnline: true,
          callActiveAt: u.callActiveAt ? new Date(u.callActiveAt).getTime() : Date.now(),
        });
      }
    } catch (err) {
      console.warn('[syncActiveUsersFromDB Error]:', err);
    }
  }

  async fetchActiveCircleUsers(): Promise<ICircleActiveUser[]> {
    if (this.activeUsersCache.size === 0) {
      await this.syncActiveUsersFromDB();
    }
    return this.getCachedActiveUsersList();
  }

  async getFilteredActiveUsers(gender = 'all', category = 'all'): Promise<ICircleActiveUser[]> {
    let users = await this.fetchActiveCircleUsers();
    if (gender !== 'all') {
      users = users.filter((u) => u.gender === gender);
    }
    if (category !== 'all') {
      const target = category.toLowerCase();
      users = users.filter(
        (u) =>
          (u.profession || '').toLowerCase().includes(target) ||
          (u.callCategory || '').toLowerCase().includes(target)
      );
    }
    return users;
  }

  setCacheUser(userId: string, data: Partial<ICircleActiveUser>): void {
    const existing = this.activeUsersCache.get(userId);
    const activeItem: ICircleActiveUser = {
      id: userId,
      _id: userId,
      name: data.name || existing?.name || 'మిత్రులు',
      teluguName: data.teluguName || existing?.teluguName || data.name || 'మిత్రులు',
      handle: data.mitraId || data.handle || existing?.handle || 'user',
      mitraId: data.mitraId || data.handle || existing?.mitraId || 'user',
      avatar: data.avatar || existing?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
      bio: data.bio || existing?.bio || '',
      teluguBio: data.teluguBio || existing?.teluguBio || '',
      location: data.location || existing?.location || 'హైదరాబాద్, తెలంగాణ',
      isVerified: Boolean(data.isVerified ?? existing?.isVerified),
      gender: data.gender || existing?.gender || 'prefer_not_to_say',
      profession: data.profession || existing?.profession || 'కమ్యూనిటీ మిత్రులు',
      callCategory: data.callCategory || existing?.callCategory || 'casuals',
      isCallActive: true,
      callLanguage: data.callLanguage || existing?.callLanguage || 'తెలుగు (Telugu)',
      callRating: data.callRating ?? existing?.callRating ?? 5.0,
      callRatingCount: data.callRatingCount ?? existing?.callRatingCount ?? 0,
      callRateCoins: data.callRateCoins ?? existing?.callRateCoins ?? 500,
      isOnline: true,
      callActiveAt: Date.now(),
    };
    this.activeUsersCache.set(userId, activeItem);
  }

  removeCacheUser(userId: string): void {
    if (!userId) return;
    this.activeUsersCache.delete(userId);
    // Robust cleanup: also purge any entry matching by id, _id, handle, or mitraId
    for (const [key, user] of this.activeUsersCache.entries()) {
      if (
        user.id === userId ||
        user._id === userId ||
        user.handle === userId ||
        user.mitraId === userId
      ) {
        this.activeUsersCache.delete(key);
      }
    }
  }

  async toggleActiveStatus(uid: string, data: any): Promise<boolean> {
    const { isCallActive, gender, profession, callLanguage, callCategory, user } = data || {};
    const activeState = Boolean(isCallActive);

    const possibleIds = Array.from(
      new Set([uid, data?.userId, user?.id, user?._id?.toString()].filter(Boolean))
    ) as string[];

    if (activeState) {
      const existing = this.activeUsersCache.get(uid);
      this.setCacheUser(uid, {
        name: user?.name || existing?.name,
        teluguName: user?.teluguName || existing?.teluguName || user?.name,
        handle: user?.mitraId || user?.handle || existing?.handle,
        mitraId: user?.mitraId || user?.handle || existing?.mitraId,
        avatar: user?.avatar || existing?.avatar,
        bio: user?.bio || existing?.bio,
        teluguBio: user?.teluguBio || existing?.teluguBio,
        location: user?.location || existing?.location,
        isVerified: user?.isVerified ?? existing?.isVerified,
        gender: gender || user?.gender || existing?.gender,
        profession: profession || user?.profession || existing?.profession,
        callCategory: callCategory || user?.callCategory || existing?.callCategory,
        callLanguage: callLanguage || user?.callLanguage || existing?.callLanguage,
        callRating: user?.callRating ?? existing?.callRating,
        callRatingCount: user?.callRatingCount ?? existing?.callRatingCount,
        callRateCoins: user?.callRateCoins ?? existing?.callRateCoins,
      });
    } else {
      for (const id of possibleIds) {
        this.removeCacheUser(id);
      }
    }

    // Persist in MongoDB asynchronously
    const updateFields: any = {
      isCallActive: activeState,
      callActiveAt: activeState ? new Date() : null,
    };
    if (gender) updateFields.gender = gender;
    if (profession) updateFields.profession = profession;
    if (callLanguage) updateFields.callLanguage = callLanguage;
    if (callCategory) updateFields.callCategory = callCategory;

    for (const id of possibleIds) {
      this.userRepo
        .updateUser(id, updateFields)
        .then((updated) => {
          if (updated && activeState) {
            const cached = this.activeUsersCache.get(id);
            if (cached) {
              cached.name = (updated as any).name || cached.name;
              cached.avatar = (updated as any).avatar || cached.avatar;
              cached.callRating = (updated as any).callRating ?? cached.callRating;
              cached.callRatingCount = (updated as any).callRatingCount ?? cached.callRatingCount;
            }
          }
        })
        .catch((e) => console.warn('[circle:toggle_active DB error]:', e));
    }

    return activeState;
  }

  async getUserById(id: string) {
    return this.userRepo.findById(id);
  }

  async getUserStatus(userId: string) {
    return this.userRepo.findByIdLean(userId, 'isCallActive gender profession callLanguage');
  }

  async updateActiveStatusViaHttp(uid: string, body: any) {
    const { isCallActive, gender, profession, callLanguage, callCategory, user: clientUser } = body;
    const activeState = Boolean(isCallActive);

    if (activeState) {
      const existing = this.activeUsersCache.get(uid);
      this.setCacheUser(uid, {
        name: clientUser?.name || existing?.name,
        teluguName: clientUser?.teluguName || existing?.teluguName,
        handle: clientUser?.mitraId || clientUser?.handle || existing?.handle,
        mitraId: clientUser?.mitraId || clientUser?.handle || existing?.mitraId,
        avatar: clientUser?.avatar || existing?.avatar,
        bio: clientUser?.bio || existing?.bio,
        teluguBio: clientUser?.teluguBio || existing?.teluguBio,
        location: clientUser?.location || existing?.location,
        isVerified: clientUser?.isVerified ?? existing?.isVerified,
        gender: gender || clientUser?.gender || existing?.gender,
        profession: profession || clientUser?.profession || existing?.profession,
        callCategory: callCategory || clientUser?.callCategory || existing?.callCategory,
        callLanguage: callLanguage || clientUser?.callLanguage || existing?.callLanguage,
        callRating: clientUser?.callRating ?? existing?.callRating,
        callRatingCount: clientUser?.callRatingCount ?? existing?.callRatingCount,
        callRateCoins: clientUser?.callRateCoins ?? existing?.callRateCoins,
      });
    } else {
      this.removeCacheUser(uid);
    }

    const updateFields: any = {
      isCallActive: activeState,
      callActiveAt: activeState ? new Date() : null,
    };
    if (gender) updateFields.gender = gender;
    if (profession) updateFields.profession = profession;
    if (callLanguage) updateFields.callLanguage = callLanguage;
    if (callCategory) updateFields.callCategory = callCategory;

    const user = await this.userRepo.updateUser(uid, updateFields);
    return user;
  }
}

export const userService = new UserService();
