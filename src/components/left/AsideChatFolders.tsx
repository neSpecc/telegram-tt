import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder } from '../../api/types';
import type { IconName } from '../../types/icons';
import { ApiFormattedText, ApiMessageEntityTypes } from '../../api/types';

import { ALL_FOLDER_ID } from '../../config';
import { selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getCustomEmojiMediaDataForInput, getInputCustomEmojiParams } from '../../util/emoji/customEmojiManager';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { buildCustomEmojiHtml } from '../middle/composer/helpers/customEmoji';

import useLang from '../../hooks/useLang';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import DropdownMenu from '../ui/DropdownMenu';

import './AsideChatFolders.scss';

type OwnProps = {
  onFolderSelect?: (folderId: number) => void;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
};

const VerticalChatFolders: FC<OwnProps & StateProps> = ({
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  onFolderSelect,
}) => {
  const { setActiveChatFolder, loadChatFolders } = getActions();
  const lang = useLang();

  const getIconName = useMemo(() => {
    return (folder: ApiChatFolder): IconName | undefined => {
      // Check for custom emoji in title entities
      if (folder.title && typeof folder.title !== 'string' && folder.title.entities) {
        const customEmojiEntity = folder.title.entities.find(
          (entity) => entity.type === ApiMessageEntityTypes.CustomEmoji,
        );
        if (customEmojiEntity && 'documentId' in customEmojiEntity) {
          return undefined; // Return undefined to indicate we should use custom emoji
        }
      }

      if (folder.id === ALL_FOLDER_ID) {
        return 'chats';
      }

      if (folder.emoticon) {
        switch (folder.emoticon) {
          case '💰': return 'money';
          case '🤖': return 'bot-filled';
          case '💬': return 'chats';
          case '⭐️': return 'star-filled';
          case '👥': return 'group';
        }
      }

      const propertyToIcon: Record<keyof Pick<ApiChatFolder,
      'excludeRead' | 'channels' | 'groups' | 'bots' | 'contacts'
      >, IconName> = {
        excludeRead: 'unread-filled',
        channels: 'channel',
        groups: 'group',
        bots: 'bot-filled',
        contacts: 'user',
      };

      Object.entries(propertyToIcon).forEach(([property, icon]) => {
        if (folder[property as keyof ApiChatFolder]) {
          return icon;
        }
      });

      return 'folder-badge';
    };
  }, []); // No dependencies since the logic is static

  const allChatsFolder: ApiChatFolder = useMemo(() => {
    return {
      id: ALL_FOLDER_ID,
      title: {
        text: lang('FilterAllChats'),
      },
      includedChatIds: MEMO_EMPTY_ARRAY,
      excludedChatIds: MEMO_EMPTY_ARRAY,
    };
  }, [lang]);

  // Load folders on mount
  useEffect(() => {
    loadChatFolders();
  }, []);

  const handleFolderClick = (folderId: number) => {
    if (folderId !== activeChatFolder) {
      setActiveChatFolder({ activeChatFolder: folderId }, { forceOnHeavyAnimation: true });
      onFolderSelect?.(folderId);
    }
  };

  const displayedFolders = useMemo(() => {
    if (!orderedFolderIds) {
      return [];
    }

    return orderedFolderIds.map((id) => {
      if (id === ALL_FOLDER_ID) {
        return allChatsFolder;
      }
      return chatFoldersById[id];
    }).filter(Boolean);
  }, [chatFoldersById, orderedFolderIds, allChatsFolder]);

  const getFolderTitleAndIcon = (folder: ApiChatFolder) => {
    let titleText = typeof folder.title === 'string' ? folder.title : folder.title.text;
    const iconName = getIconName(folder);
    let icon = iconName ? <Icon name={iconName} className="folder-item-icon custom-emoji" /> : undefined;

    if (folder.title && typeof folder.title !== 'string' && folder.title.entities) {
      const customEmojiEntity = folder.title.entities.find(
        (entity) => entity.type === ApiMessageEntityTypes.CustomEmoji,
      );
      if (customEmojiEntity && 'documentId' in customEmojiEntity) {
        // Trim the emoji from the title
        titleText = titleText.slice(0, customEmojiEntity.offset)
          + titleText.slice(customEmojiEntity.offset + customEmojiEntity.length);
        titleText = titleText.trim();

        icon = (
          <CustomEmoji
            documentId={customEmojiEntity.documentId}
            size={32}
            className="folder-item-icon"
            withSharedAnimation
          />
        );
      }
    }

    return { titleText, icon };
  };

  return (
    <div className="VerticalChatFolders">
      {/* <DropdownMenu
        trigger={MainButton}
        footer={`${APP_NAME} ${versionString}`}
        className={buildClassName(
          'main-menu',
          oldLang.isRtl && 'rtl',
          shouldHideSearch && oldLang.isRtl && 'right-aligned',
          shouldDisableDropdownMenuTransitionRef.current && oldLang.isRtl && 'disable-transition',
        )}
        forceOpen={isBotMenuOpen}
        positionX={shouldHideSearch && oldLang.isRtl ? 'right' : 'left'}
        transformOriginX={IS_ELECTRON && IS_MAC_OS && !isFullscreen ? 90 : undefined}
        onTransitionEnd={oldLang.isRtl ? handleDropdownMenuTransitionEnd : undefined}
      >
        <LeftSideMenuItems
          onSelectArchived={onSelectArchived}
          onSelectContacts={onSelectContacts}
          onSelectSettings={onSelectSettings}
          onBotMenuOpened={markBotMenuOpen}
          onBotMenuClosed={unmarkBotMenuOpen}
        />
      </DropdownMenu> */}
      <div className="folder-items">
        {displayedFolders.map((folder) => {
          const { titleText, icon } = getFolderTitleAndIcon(folder);
          return (
            <div
              key={folder.id}
              className={buildClassName('folder-item', folder.id === activeChatFolder && 'active')}
              onClick={() => handleFolderClick(folder.id)}
            >
              {icon}
              {titleText}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(withGlobal<OwnProps>(
  (global): StateProps => {
    const {
      chatFolders: {
        byId: chatFoldersById,
        orderedIds: orderedFolderIds,
      },
    } = global;

    const { activeChatFolder } = selectTabState(global);

    return {
      chatFoldersById,
      orderedFolderIds,
      activeChatFolder,
    };
  },
)(VerticalChatFolders));
