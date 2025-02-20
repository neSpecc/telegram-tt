import type { FC } from '../../lib/teact/teact';
import React, {
  createPortal, memo, useEffect, useMemo, useState,
} from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { ApiChatFolder } from '../../api/types';
import type { IconName } from '../../types/icons';
import { ApiFormattedText, ApiMessageEntityTypes } from '../../api/types';
import { LeftColumnContent } from '../../types';

import { ALL_FOLDER_ID } from '../../config';
import { selectIsCurrentUserPremium, selectTabState } from '../../global/selectors';
import buildClassName from '../../util/buildClassName';
import { getCustomEmojiMediaDataForInput, getInputCustomEmojiParams } from '../../util/emoji/customEmojiManager';
import { MEMO_EMPTY_ARRAY } from '../../util/memo';
import { buildCustomEmojiHtml } from '../middle/composer/helpers/customEmoji';

import useFlag from '../../hooks/useFlag';
import { useFolderManagerForUnreadCounters } from '../../hooks/useFolderManager';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import CustomEmoji from '../common/CustomEmoji';
import Icon from '../common/icons/Icon';
import MainDropdownMenu from './main/MainDropdownMenu';

import './AsideChatFolders.scss';

type OwnProps = {
  onFolderSelect?: (folderId: number) => void;
  content: LeftColumnContent;
  onContentChange: (content: LeftColumnContent) => void;
  onReset: NoneToVoidFunction;
};

type StateProps = {
  chatFoldersById: Record<number, ApiChatFolder>;
  orderedFolderIds?: number[];
  activeChatFolder: number;
  isCurrentUserPremium: boolean;
};

const AsideChatFolders: FC<OwnProps & StateProps> = ({
  chatFoldersById,
  orderedFolderIds,
  activeChatFolder,
  content,
  onReset,
  onContentChange,
}) => {
  const { loadChatFolders, setActiveChatFolder } = getActions();
  const lang = useLang();
  const folderCountersById = useFolderManagerForUnreadCounters();

  const getIconName = useMemo(() => {
    return (folder: ApiChatFolder): IconName | undefined => {
      if (folder.title && typeof folder.title !== 'string' && folder.title.entities) {
        const customEmojiEntity = folder.title.entities.find(
          (entity) => entity.type === ApiMessageEntityTypes.CustomEmoji,
        );
        if (customEmojiEntity && 'documentId' in customEmojiEntity) {
          return undefined;
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

      return Object.entries(propertyToIcon).find(([property]) => {
        return folder[property as keyof ApiChatFolder];
      })?.[1] || 'folder-badge';
    };
  }, []);

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

  useEffect(() => {
    loadChatFolders();
  }, []);

  const handleFolderClick = useLastCallback((index: number) => {
    setActiveChatFolder({ activeChatFolder: index }, { forceOnHeavyAnimation: true });
  });

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

  const { closeForumPanel } = getActions();

  const handleSelectSettings = useLastCallback(() => {
    onContentChange(LeftColumnContent.Settings);
  });

  const handleSelectContacts = useLastCallback(() => {
    onContentChange(LeftColumnContent.Contacts);
  });

  const handleSelectArchived = useLastCallback(() => {
    onContentChange(LeftColumnContent.Archived);
    closeForumPanel();
  });

  return (
    <div className="AsideChatFolders">
      <MainDropdownMenu
        shouldSkipTransition
        shouldHideSearch
        onSelectArchived={handleSelectArchived}
        onSelectContacts={handleSelectContacts}
        onSelectSettings={handleSelectSettings}
        content={content}
        onReset={onReset}
        disableBackButton
      />
      <div className="folder-items">
        {displayedFolders.map((folder, index) => {
          const { titleText, icon } = getFolderTitleAndIcon(folder);
          const counter = folderCountersById[folder.id];
          const badgeCount = counter?.notificationsCount;

          return (
            <div
              key={folder.id}
              className={buildClassName('folder-item', index === activeChatFolder && 'active')}
              onClick={() => handleFolderClick(index)}
            >
              {icon}
              {titleText}
              {Boolean(badgeCount) && folder.id !== ALL_FOLDER_ID && (
                <div className="badge">{badgeCount}</div>
              )}
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
    const isCurrentUserPremium = selectIsCurrentUserPremium(global);

    return {
      chatFoldersById,
      orderedFolderIds,
      activeChatFolder,
      isCurrentUserPremium,
    };
  },
)(AsideChatFolders));
