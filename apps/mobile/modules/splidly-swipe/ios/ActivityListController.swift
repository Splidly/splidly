import SwiftUI
import UIKit

private struct ActivityRowButtonStyle: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    // Keep the label opaque and highlight its entire bounds, including empty
    // space. The list cell owns clipping at grouped corners and during swipes.
    configuration.label
      .frame(maxWidth: .infinity, alignment: .leading)
      .background(configuration.isPressed ? Color(uiColor: .tertiarySystemFill) : .clear)
  }
}

@MainActor
final class ActivityListController: UICollectionViewController {
  private let plain: Bool
  private var dataSource: UICollectionViewDiffableDataSource<String, String>!
  private var sections: [ActivitySection] = []
  private var sectionsByKey: [String: ActivitySection] = [:]
  private var rows: [String: ActivityRow] = [:]
  private var completedRows: Set<String> = []
  private var pendingSwipe: (id: String, rowKey: String, complete: (Bool) -> Void)?
  private var lastCompletionId: String?
  private var onDeleteRequested: (String, String) -> Void = { _, _ in }
  private var onRefresh: (String) -> Void = { _ in }
  private var onScroll: ([String: Any]) -> Void = { _ in }
  private var onHostedLayout: (String, CGFloat) -> Void = { _, _ in }
  private var onPreviewOpen: (String) -> Void = { _ in }
  private var onPreviewAction: (String, String) -> Void = { _, _ in }
  private var onRowPress: (String) -> Void = { _ in }
  private var hostedWidths: [String: CGFloat] = [:]
  private var measuredWidthKeys: Set<String> = []
  private var initialMeasurementsComplete = false
  private var appliedHostedContent: [ActivityHostedContent] = []
  private var appliedSettings: [String: ActivitySettingsRowRecord] = [:]
  private var appliedSectionText: [String: String] = [:]
  private var avatarImages: [String: UIImage] = [:]
  private var avatarLoads: [String: Task<Void, Never>] = [:]
  private var expandedMembers: Set<String> = []
  private let snapshotQueue = SnapshotUpdateQueue()
  private var snapshotApplying = false
  private var snapshotPending = false
  private var snapshotCompletions: [() -> Void] = []
  private var pendingRefreshId: String?
  private var shouldFinishRefresh = false
  private let refreshControl = UIRefreshControl()

  init(plain: Bool = false) {
    self.plain = plain
    super.init(collectionViewLayout: UICollectionViewFlowLayout())
    installsStandardGestureForInteractiveMovement = false
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError("init(coder:) is unavailable") }

  override func viewDidLoad() {
    super.viewDidLoad()
    collectionView.dataSource = nil
    var configuration = UICollectionLayoutListConfiguration(appearance: plain ? .plain : .insetGrouped)
    configuration.backgroundColor = .clear
    if plain {
      configuration.separatorConfiguration.topSeparatorInsets = NSDirectionalEdgeInsets(top: 0, leading: 94, bottom: 0, trailing: 16)
      configuration.separatorConfiguration.bottomSeparatorInsets = NSDirectionalEdgeInsets(top: 0, leading: 94, bottom: 0, trailing: 16)
      configuration.itemSeparatorHandler = { [weak self] indexPath, separator in
        var result = separator
        result.topSeparatorVisibility = .hidden
        if let model = self?.section(at: indexPath.section), indexPath.item == model.rows.count - 1 {
          result.bottomSeparatorVisibility = .hidden
        }
        return result
      }
    }
    configuration.headerMode = .supplementary
    configuration.footerMode = .supplementary
    configuration.trailingSwipeActionsConfigurationProvider = { [weak self] indexPath in
      self?.swipeActions(at: indexPath)
    }
    let layout = UICollectionViewCompositionalLayout { [weak self] index, environment in
      guard let self, let model = self.section(at: index) else { return nil }
      let section = NSCollectionLayoutSection.list(
        using: configuration, layoutEnvironment: environment)
      if self.plain {
        section.contentInsets = NSDirectionalEdgeInsets(top: 0, leading: model.isOverview ? 16 : 0, bottom: 0, trailing: model.isOverview ? 16 : 0)
      }
      let nativeBoundaries = section.boundarySupplementaryItems
      // The layout knows the native section width even before an empty
      // section creates a header view. Start Yoga measurement without needing
      // an expense row or a guessed screen width as a bootstrap placeholder.
      let width =
        environment.container.effectiveContentSize.width
        - section.contentInsets.leading - section.contentInsets.trailing
      let nativeHeader = nativeBoundaries.first {
        $0.elementKind == UICollectionView.elementKindSectionHeader
      }
      let nativeFooter = nativeBoundaries.first {
        $0.elementKind == UICollectionView.elementKindSectionFooter
      }
      if !model.isOverview && model.headerTitle == nil {
        self.reportHostedWidth(
          model.header.key,
          width: width - (nativeHeader?.contentInsets.leading ?? 0)
            - (nativeHeader?.contentInsets.trailing ?? 0))
      }
      if let footer = model.footer {
        self.reportHostedWidth(
          footer.key,
          width: width - (nativeFooter?.contentInsets.leading ?? 0)
            - (nativeFooter?.contentInsets.trailing ?? 0))
      }
      if model.isOverview {
        // The overview is ordinary content, not a supplementary view anchored
        // above an expense section. Its measured frame begins at the list top,
        // including when the group has no expense rows.
        let size = NSCollectionLayoutSize(
          widthDimension: .fractionalWidth(1),
          heightDimension: .absolute(max(1, model.header.height)))
        let item = NSCollectionLayoutItem(layoutSize: size)
        let group = NSCollectionLayoutGroup.vertical(layoutSize: size, subitems: [item])
        let overview = NSCollectionLayoutSection(group: group)
        overview.contentInsets = NSDirectionalEdgeInsets(
          top: 8, leading: section.contentInsets.leading,
          bottom: 0, trailing: section.contentInsets.trailing)
        self.reportHostedWidth(model.header.key, width: width)
        if let content = model.footer {
          overview.boundarySupplementaryItems = [
            self.boundary(
              content, kind: UICollectionView.elementKindSectionFooter,
              alignment: .bottom, original: nativeFooter)
          ]
        }
        return overview
      }
      // Supplementary views do not inherit a cell's self-sizing behavior.
      // Reserve the actual Yoga height instead of letting the header paint
      // beyond UIKit's estimated frame and overlap the first expense.
      if model.headerTitle != nil, let nativeHeader {
        // UIKit measures ordinary settings headings itself. Do not replace
        // their self-sizing boundary with a React host's placeholder height.
        nativeHeader.pinToVisibleBounds = false
        section.boundarySupplementaryItems = [nativeHeader]
      } else {
        section.boundarySupplementaryItems = self.plain && model.header.height == 0 ? [] : [
          self.boundary(
            model.header, kind: UICollectionView.elementKindSectionHeader,
            alignment: .top, original: nativeHeader)
        ]
      }
      if model.footerTitle != nil, let nativeFooter {
        nativeFooter.pinToVisibleBounds = false
        section.boundarySupplementaryItems.append(nativeFooter)
      } else if let content = model.footer {
        section.boundarySupplementaryItems.append(
          self.boundary(
            content, kind: UICollectionView.elementKindSectionFooter,
            alignment: .bottom, original: nativeFooter))
      }
      return section
    }
    collectionView.setCollectionViewLayout(layout, animated: false)
    collectionView.backgroundColor = .clear
    collectionView.contentInsetAdjustmentBehavior = .automatic
    collectionView.keyboardDismissMode = .interactive
    collectionView.alwaysBounceVertical = true
    collectionView.delegate = self
    // Only opt-in rows use UIKit selection. UIKit owns their transient gray
    // highlight, touch cancellation during scrolling and the full cell target.
    collectionView.allowsSelection = true
    collectionView.selfSizingInvalidation = .enabledIncludingConstraints

    let cells = UICollectionView.CellRegistration<UICollectionViewListCell, String> {
      [weak self] cell, indexPath, key in
      guard let row = self?.rows[key] else { return }
      // The member outline has exactly two levels. Do not ask the data source
      // to materialize a section snapshot while it is configuring an apply.
      cell.indentationLevel = key.hasPrefix("member-detail:") ? 1 : 0
      let plain = self?.plain == true
      if plain {
        // Keep UIKit's swipe background and rounding. A clear configuration
        // removes that styling even while the native swipe actions are open.
        cell.backgroundConfiguration = .clear()
        cell.configurationUpdateHandler = { cell, state in
          var background: UIBackgroundConfiguration
          if #available(iOS 18.0, *) {
            background = UIBackgroundConfiguration.listCell().updated(for: state)
          } else {
            background = UIBackgroundConfiguration.listPlainCell().updated(for: state)
          }
          if !state.isSwiped {
            // Plain rows stay transparent at rest and highlight only on tap.
            background.backgroundColor = row.selectable && (state.isHighlighted || state.isSelected)
              ? .tertiarySystemFill : .clear
          }
          cell.backgroundConfiguration = background
        }
        cell.setNeedsUpdateConfiguration()
      } else {
        // Apply the grouped cell's native pressed background explicitly, also
        // for hosted settings labels whose embedded buttons do not own taps.
        cell.configurationUpdateHandler = { cell, state in
          if #available(iOS 18.0, *) {
            cell.backgroundConfiguration = UIBackgroundConfiguration.listCell().updated(for: state)
          } else {
            cell.backgroundConfiguration = UIBackgroundConfiguration.listGroupedCell().updated(for: state)
          }
        }
        cell.setNeedsUpdateConfiguration()
      }
      // The embedded label must not consume the touch before UIKit can
      // highlight and select its cell. Reset this when a cell is reused.
      cell.contentView.isUserInteractionEnabled = !(row.selectable || row.settings?.disclosure == true)
      cell.accessories = []
      cell.accessibilityIdentifier = nil
      if let settings = row.settings {
        self?.configureSettingsCell(cell, settings: settings, key: key)      } else if let hosted = row.hostedContent, let self {
        cell.contentConfiguration = self.hostedConfiguration(hosted)
      } else {
        cell.contentConfiguration = UIHostingConfiguration {
          row.content.buttonStyle(ActivityRowButtonStyle()).textSelection(.disabled)
        }
        .margins(.all, 0)
      }
    }
    let overviewCells = UICollectionView.CellRegistration<UICollectionViewCell, String> {
      [weak self] cell, _, key in
      guard let self, let content = self.rows[key]?.hostedContent else { return }
      cell.contentConfiguration = self.hostedConfiguration(content)
      cell.backgroundConfiguration = .clear()
    }
    dataSource = UICollectionViewDiffableDataSource<String, String>(collectionView: collectionView)
    { [weak self] collectionView, indexPath, key in
      guard let self else { return nil }
      if let overview = self.sections.first, overview.isOverview, overview.header.key == key {
        return collectionView.dequeueConfiguredReusableCell(
          using: overviewCells, for: indexPath, item: key)
      }
      return collectionView.dequeueConfiguredReusableCell(using: cells, for: indexPath, item: key)
    }
    let headers = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
      elementKind: UICollectionView.elementKindSectionHeader
    ) { [weak self] cell, _, indexPath in
      guard let self, let section = self.section(at: indexPath.section) else { return }
      self.configureHeader(cell, section: section)
      cell.backgroundConfiguration = .clear()
    }
    let footers = UICollectionView.SupplementaryRegistration<UICollectionViewListCell>(
      elementKind: UICollectionView.elementKindSectionFooter
    ) { [weak self] cell, _, indexPath in
      guard let self, let section = self.section(at: indexPath.section) else { return }
      self.configureFooter(cell, section: section)
      cell.backgroundConfiguration = .clear()
    }
    dataSource.supplementaryViewProvider = { collectionView, kind, indexPath in
      if kind == UICollectionView.elementKindSectionHeader {
        return collectionView.dequeueConfiguredReusableSupplementary(using: headers, for: indexPath)
      }
      return collectionView.dequeueConfiguredReusableSupplementary(using: footers, for: indexPath)
    }
    refreshControl.addTarget(self, action: #selector(refresh), for: .valueChanged)
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    // Automatic insets still belong to UIKit. Add breathing room only when
    // content exceeds the viewport, so short lists have no resting scroll range.
    let nativeBottomInset = collectionView.adjustedContentInset.bottom - collectionView.contentInset.bottom
    let visibleHeight = max(0, collectionView.bounds.height - collectionView.adjustedContentInset.top - nativeBottomInset)
    let bottomSpacing: CGFloat = collectionView.contentSize.height > visibleHeight + 1 ? 16 : 0
    if collectionView.contentInset.bottom != bottomSpacing {
      collectionView.contentInset.bottom = bottomSpacing
    }
  }

  func update(
    sections: [ActivitySection],
    completion: ActivitySwipeResult?,
    refreshCompletion: String?,
    refreshEnabled: Bool,
    bounces: Bool,
    onDeleteRequested: @escaping (String, String) -> Void,
    onRefresh: @escaping (String) -> Void,
    onScroll: @escaping ([String: Any]) -> Void,
    onHostedLayout: @escaping (String, CGFloat) -> Void,
    onPreviewOpen: @escaping (String) -> Void,
    onPreviewAction: @escaping (String, String) -> Void,
    onRowPress: @escaping (String) -> Void
  ) {
    loadViewIfNeeded()
    self.sections = sections
    // Keep models for outgoing sections until UIKit finishes its snapshot.
    // Layout and supplementary indices belong to that snapshot, not React's
    // latest section array during an insertion or deletion.
    for section in sections { sectionsByKey[section.key] = section }
    self.onDeleteRequested = onDeleteRequested
    self.onRefresh = onRefresh
    self.onScroll = onScroll
    self.onHostedLayout = onHostedLayout
    self.onPreviewOpen = onPreviewOpen
    self.onPreviewAction = onPreviewAction
    self.onRowPress = onRowPress
    collectionView.bounces = bounces
    collectionView.alwaysBounceVertical = bounces
    let desiredRefreshControl = refreshEnabled ? refreshControl : nil
    if collectionView.refreshControl !== desiredRefreshControl {
      collectionView.refreshControl = desiredRefreshControl
    }
    if let refreshCompletion, refreshCompletion == pendingRefreshId {
      pendingRefreshId = nil
      shouldFinishRefresh = true
    }
    defer { finishRefreshIfNotDragging() }

    let currentKeys = Set(sections.flatMap(\.rows).map(\.key))
    completedRows.formIntersection(currentKeys)
    if let completion, completion.requestId != lastCompletionId {
      lastCompletionId = completion.requestId
      if let pending = pendingSwipe, pending.id == completion.requestId {
        pendingSwipe = nil
        if completion.deleted {
          completedRows.insert(pending.rowKey)
          applySnapshot { pending.complete(true) }
        } else {
          pending.complete(false)
          applySnapshot()
        }
        return
      }
    }
    // Keep the native list's data source stable while UIKit waits for the
    // confirmation and server result. React query updates must not end the swipe.
    if pendingSwipe == nil { applySnapshot() }
  }

  private func applySnapshot(completion: (() -> Void)? = nil) {
    if snapshotApplying {
      snapshotPending = true
      if let completion { snapshotCompletions.append(completion) }
      return
    }
    rows = Dictionary(uniqueKeysWithValues: sections.flatMap(\.rows).map { ($0.key, $0) })
    expandedMembers.formIntersection(rows.keys)
    for section in sections where section.isOverview {
      rows[section.header.key] = ActivityRow(
        key: section.header.key, content: AnyView(EmptyView()), hostedContent: section.header,
        canDelete: false, deletionDisabled: false)
    }
    if sections.contains(where: { $0.rows.contains(where: { $0.settings?.disclosure == true }) }) {
      applyMemberSnapshots(completion: completion)
      return
    }
    var snapshot = NSDiffableDataSourceSnapshot<String, String>()
    let canAnimate = initialMeasurementsComplete
    // Only the overview must finish measuring before the first insertion.
    // Offscreen date headers must not block a long list from being displayed.
    // A measured empty overview must also release the rows. React uses -1
    // until measurement arrives, then reports zero for section-only lists.
    if let first = sections.first, first.header.height >= 0 {
      initialMeasurementsComplete = true
    }
    for section in sections {
      snapshot.appendSections([section.key])
      snapshot.appendItems(
        section.isOverview
          ? [section.header.key]
          : initialMeasurementsComplete
            ? section.rows.map(\.key).filter { !completedRows.contains($0) }
            : [],
        toSection: section.key
      )
    }
    let previous = dataSource.snapshot()
    let changed =
      previous.sectionIdentifiers != snapshot.sectionIdentifiers
      || previous.itemIdentifiers != snapshot.itemIdentifiers
    let hostedContent = sections.flatMap { section in
      [section.header] + section.rows.compactMap(\.hostedContent)
        + (section.footer.map { [$0] } ?? [])
    }
    let hostedLayoutChanged = hostedContent != appliedHostedContent
    let settings = rows.compactMapValues(\.settings)
    let settingsChanged = settings != appliedSettings
    let sectionText = Dictionary(uniqueKeysWithValues: sections.flatMap { section in
      [("header:\(section.key)", section.headerTitle ?? ""),
       ("footer:\(section.key)", section.footerTitle ?? "")]
    })
    // Expo's child views observe their React props themselves. A refresh-state
    // or navigation-title update must not recreate every cell and invalidate
    // the collection layout during a pull gesture.
    guard changed || hostedLayoutChanged || settingsChanged || sectionText != appliedSectionText else {
      completion?()
      return
    }
    let previousHosted = Dictionary(uniqueKeysWithValues: appliedHostedContent.map { ($0.key, $0) })
    let retained = Set(previous.itemIdentifiers).intersection(snapshot.itemIdentifiers)
    let hostedRowsToUpdate = retained.filter { key in
      if rows[key]?.settings != nil || appliedSettings[key] != nil {
        return appliedSettings[key] != rows[key]?.settings
      }
      guard let content = rows[key]?.hostedContent else { return changed }
      return previousHosted[content.key] != content
    }
    appliedHostedContent = hostedContent
    appliedSettings = settings
    appliedSectionText = sectionText
    if !changed && !settingsChanged {
      UIView.performWithoutAnimation {
        for key in hostedRowsToUpdate {
          if let indexPath = dataSource.indexPath(for: key),
            let cell = collectionView.cellForItem(at: indexPath),
            let content = rows[key]?.hostedContent {
            cell.contentConfiguration = hostedConfiguration(content)
          }
        }
        updateVisibleSupplementaries()
      }
      completion?()
      return
    }
    snapshot.reconfigureItems(Array(hostedRowsToUpdate))
    let overviewKeys = Set(sections.filter(\.isOverview).map(\.header.key))
    let hadActivity = previous.itemIdentifiers.contains { !overviewKeys.contains($0) }
    let hasActivity = snapshot.itemIdentifiers.contains { !overviewKeys.contains($0) }
    snapshotApplying = true
    applyDataSnapshot(
      snapshot, animatingDifferences: canAnimate && hadActivity && hasActivity
    ) { [weak self] in
      if let self {
        UIView.performWithoutAnimation { self.updateVisibleSupplementaries() }
        let retainedKeys = Set(self.sections.map(\.key)).union(
          self.dataSource.snapshot().sectionIdentifiers)
        self.sectionsByKey = self.sectionsByKey.filter { retainedKeys.contains($0.key) }
      }
      if let self { self.finishSnapshot(completion: completion) }
      else { completion?() }
    }
  }

  private func hostedConfiguration(_ content: ActivityHostedContent) -> ActivityHostedConfiguration
  {
    ActivityHostedConfiguration(content: content) { [weak self] key, width in
      self?.reportHostedWidth(key, width: width, measured: true)
    }
  }

  private func applyDataSnapshot(
    _ snapshot: NSDiffableDataSourceSnapshot<String, String>,
    animatingDifferences: Bool,
    completion: (() -> Void)? = nil
  ) {
    snapshotQueue.enqueue { [weak self] finished in
      guard let self else { finished(); return }
      dataSource.apply(snapshot, animatingDifferences: animatingDifferences) {
        finished()
        // Layout/measurement callbacks and the next section apply must also
        // leave UIKit's completion stack before they can request more updates.
        DispatchQueue.main.async { completion?() }
      }
    }
  }

  private func applySectionSnapshot(
    _ snapshot: NSDiffableDataSourceSectionSnapshot<String>,
    to section: String,
    animatingDifferences: Bool,
    completion: (() -> Void)? = nil
  ) {
    snapshotQueue.enqueue { [weak self] finished in
      guard let self else { finished(); return }
      dataSource.apply(snapshot, to: section, animatingDifferences: animatingDifferences) {
        finished()
        DispatchQueue.main.async { completion?() }
      }
    }
  }

  private func applyMemberSnapshots(completion: (() -> Void)?) {
    // A member and its details are separate UIKit rows. UIKit owns the outline
    // animation, so SwiftUI never animates content inside a resizing cell.
    let canAnimate = initialMeasurementsComplete && !UIAccessibility.isReduceMotionEnabled
    if let first = sections.first, first.header.height >= 0 { initialMeasurementsComplete = true }
    var trees: [String: NSDiffableDataSourceSectionSnapshot<String>] = [:]
    for section in sections {
      var tree = NSDiffableDataSourceSectionSnapshot<String>()
      if section.isOverview {
        tree.append([section.header.key])
      } else if initialMeasurementsComplete {
        for row in section.rows where !completedRows.contains(row.key) {
          tree.append([row.key])
          if let settings = row.settings, settings.disclosure {
            for (index, detail) in settings.details.enumerated() {
              let key = "member-detail:\(row.key):\(index)"
              var content = ActivitySettingsRowRecord()
              content.title = detail.title
              content.value = detail.value.isEmpty ? nil : detail.value
              content.valueTone = detail.tone
              content.showsDisclosure = false
              rows[key] = ActivityRow(key: key, content: AnyView(EmptyView()), hostedContent: nil,
                canDelete: false, deletionDisabled: false, settings: content)
              tree.append([key], to: row.key)
            }
            if expandedMembers.contains(row.key) { tree.expand([row.key]) }
          }
        }
      }
      trees[section.key] = tree
    }
    let settings = rows.compactMapValues(\.settings)
    let changedSettings = settings.keys.filter { settings[$0] != appliedSettings[$0] }
    let hosted = sections.flatMap { [$0.header] + $0.rows.compactMap(\.hostedContent) + ($0.footer.map { [$0] } ?? []) }
    let previousHosted = Dictionary(uniqueKeysWithValues: appliedHostedContent.map { ($0.key, $0) })
    let changedHosted = Set(hosted.filter { previousHosted[$0.key] != $0 }.map(\.key))
    let sectionText = Dictionary(uniqueKeysWithValues: sections.flatMap {
      [("header:\($0.key)", $0.headerTitle ?? ""), ("footer:\($0.key)", $0.footerTitle ?? "")]
    })
    let previous = dataSource.snapshot()
    let sectionKeys = sections.map(\.key)
    let sectionsChanged = previous.sectionIdentifiers != sectionKeys
    let changedTrees = sectionKeys.filter { key in
      guard !sectionsChanged else { return true }
      let current = dataSource.snapshot(for: key)
      let desired = trees[key]!
      return current.items != desired.items || current.rootItems != desired.rootItems
        || desired.rootItems.contains { current.isExpanded($0) != desired.isExpanded($0) }
    }
    guard sectionsChanged || !changedTrees.isEmpty || !changedSettings.isEmpty
      || hosted != appliedHostedContent || sectionText != appliedSectionText else {
      completion?()
      return
    }
    appliedSettings = settings
    appliedHostedContent = hosted
    appliedSectionText = sectionText
    snapshotApplying = true
    func applyNext(_ index: Int) {
      guard index < changedTrees.count else {
        UIView.performWithoutAnimation {
          // The overview is a hosted cell, not a supplementary header. Its
          // first configuration is invisible until React supplies its height.
          // Refresh it even when the native member rows have not changed.
          for indexPath in collectionView.indexPathsForVisibleItems {
            guard let key = dataSource.itemIdentifier(for: indexPath),
              let content = rows[key]?.hostedContent, changedHosted.contains(content.key),
              let cell = collectionView.cellForItem(at: indexPath) else { continue }
            cell.contentConfiguration = hostedConfiguration(content)
          }
          let changedKeys = Set(changedSettings)
          for indexPath in collectionView.indexPathsForVisibleItems {
            guard let key = dataSource.itemIdentifier(for: indexPath), changedKeys.contains(key),
              let row = rows[key], let settings = row.settings,
              let cell = collectionView.cellForItem(at: indexPath) as? UICollectionViewListCell else { continue }
            // Refresh the content configuration without mutating the collection
            // view. Insertions and deletions belong to its diffable snapshots.
            cell.contentView.isUserInteractionEnabled = !(row.selectable || settings.disclosure)
            configureSettingsCell(cell, settings: settings, key: key)
          }
          updateVisibleSupplementaries()
        }
        finishSnapshot(completion: completion)
        return
      }
      let key = changedTrees[index]
      applySectionSnapshot(trees[key]!, to: key, animatingDifferences: canAnimate && !sectionsChanged) {
        applyNext(index + 1)
      }
    }
    if sectionsChanged {
      var structure = NSDiffableDataSourceSnapshot<String, String>()
      structure.appendSections(sectionKeys)
      for key in sectionKeys where previous.sectionIdentifiers.contains(key) {
        structure.appendItems(previous.itemIdentifiers(inSection: key).filter { rows[$0] != nil }, toSection: key)
      }
      applyDataSnapshot(structure, animatingDifferences: false) { applyNext(0) }
    } else {
      applyNext(0)
    }
  }

  private func finishSnapshot(completion: (() -> Void)? = nil) {
    snapshotApplying = false
    let callbacks = snapshotCompletions
    snapshotCompletions.removeAll()
    if snapshotPending {
      snapshotPending = false
      applySnapshot {
        completion?()
        callbacks.forEach { $0() }
      }
    } else {
      completion?()
      callbacks.forEach { $0() }
    }
  }

  private func toggleMember(_ key: String) {
    guard pendingSwipe == nil, rows[key]?.settings?.disclosure == true,
      let indexPath = dataSource.indexPath(for: key),
      let section = dataSource.sectionIdentifier(for: indexPath.section) else { return }
    if expandedMembers.contains(key) { expandedMembers.remove(key) }
    else { expandedMembers.insert(key) }
    if snapshotApplying {
      snapshotPending = true
      return
    }
    var tree = dataSource.snapshot(for: section)
    guard tree.contains(key) else { return }
    if expandedMembers.contains(key) { tree.expand([key]) }
    else { tree.collapse([key]) }
    snapshotApplying = true
    applySectionSnapshot(tree, to: section, animatingDifferences: !UIAccessibility.isReduceMotionEnabled) { [weak self] in
      self?.finishSnapshot()
    }
  }

  private func configureHeader(_ cell: UICollectionViewCell, section: ActivitySection) {
    if let title = section.headerTitle {
      var configuration = UIListContentConfiguration.groupedHeader()
      configuration.text = title
      configuration.textProperties.transform = .none
      configuration.textProperties.color = .secondaryLabel
      cell.contentConfiguration = configuration
      cell.accessibilityTraits.insert(.header)
    } else {
      cell.contentConfiguration = hostedConfiguration(section.header)
      cell.accessibilityTraits.remove(.header)
    }
  }

  private func configureFooter(_ cell: UICollectionViewCell, section: ActivitySection) {
    if let title = section.footerTitle {
      var configuration = UIListContentConfiguration.groupedFooter()
      configuration.text = title
      cell.contentConfiguration = configuration
    } else if let footer = section.footer {
      cell.contentConfiguration = hostedConfiguration(footer)
    } else {
      cell.contentConfiguration = UIHostingConfiguration { EmptyView() }.margins(.all, 0)
    }
  }

  private func configureSettingsCell(
    _ cell: UICollectionViewListCell, settings: ActivitySettingsRowRecord, key: String
  ) {
    let usesSubtitle = settings.identity || (settings.subtitle != nil && settings.value == nil)
    var configuration = usesSubtitle
      ? UIListContentConfiguration.subtitleCell() : UIListContentConfiguration.valueCell()
    if settings.disclosure || !settings.balances.isEmpty || key.hasPrefix("member-detail:") {
      configuration.directionalLayoutMargins.top = 8
      configuration.directionalLayoutMargins.bottom = 8
    }
    configuration.text = settings.title
    configuration.secondaryText = usesSubtitle ? settings.subtitle : settings.value
    configuration.textProperties.numberOfLines = 0
    configuration.secondaryTextProperties.numberOfLines = 0
    if !usesSubtitle && (settings.disclosure || key.hasPrefix("member-detail:")) {
      configuration.secondaryTextProperties.font = UIFontMetrics(forTextStyle: .body).scaledFont(
        for: .systemFont(ofSize: 17, weight: .semibold), compatibleWith: traitCollection)
    }
    configuration.textProperties.color = !settings.enabled ? .tertiaryLabel
      : settings.destructive ? .systemRed : .label
    configuration.secondaryTextProperties.color = settings.enabled ? .secondaryLabel : .tertiaryLabel
    if settings.enabled && !settings.identity {
      switch settings.valueTone {
      case "negative": configuration.secondaryTextProperties.color = .systemRed
      case "positive": configuration.secondaryTextProperties.color = .systemGreen
      default: break
      }
    }
    if !settings.balances.isEmpty {
      // Multiline secondary text makes UIKit move the value below the name.
      // The balance belongs to a separate trailing accessory instead.
      configuration.secondaryText = nil
    }
    configuration.image = settings.symbol.isEmpty ? nil : UIImage(systemName: settings.symbol)
    configuration.imageProperties.tintColor = settings.enabled ? .systemBlue : .tertiaryLabel
    if settings.disclosure || key == "invite" {
      configuration.imageProperties.reservedLayoutSize = CGSize(width: 36, height: 36)
      configuration.imageToTextPadding = 16
    }
    if settings.identity || settings.avatar || settings.avatarFallback != nil {
      if settings.identity { configuration.textProperties.font = .preferredFont(forTextStyle: .title3) }
      let size: CGFloat = settings.identity ? 56 : settings.disclosure ? 36 : 40
      configuration.imageProperties.tintColor = .secondaryLabel
      configuration.imageProperties.maximumSize = CGSize(width: size, height: size)
      configuration.imageProperties.cornerRadius = settings.avatarFallback?.rounded == true ? size * 0.28 : size / 2
      if settings.avatarFallback != nil {
        configuration.image = avatarFallback(settings, size: size)
      } else {
        configuration.imageProperties.preferredSymbolConfiguration = UIImage.SymbolConfiguration(pointSize: size)
      }
      if let uri = settings.imageUri {
        if let photo = avatarImages[uri] {
          configuration.image = photo
        } else if let url = URL(string: uri), url.isFileURL,
          let photo = UIImage(contentsOfFile: url.path) {
          configuration.image = photo.preparingThumbnail(of: CGSize(width: size, height: size)) ?? photo
        } else if uri.hasPrefix("data:image/"), let payload = uri.split(separator: ",", maxSplits: 1).last,
          let data = Data(base64Encoded: String(payload)), let photo = UIImage(data: data) {
          let thumbnail = photo.preparingThumbnail(of: CGSize(width: size, height: size)) ?? photo
          avatarImages[uri] = thumbnail
          configuration.image = thumbnail
        } else {
          loadAvatar(uri)
        }
      }
    }
    cell.contentConfiguration = configuration
    if let value = settings.toggleValue {
      let toggle = UISwitch()
      toggle.isOn = value
      toggle.isEnabled = settings.enabled
      toggle.accessibilityLabel = settings.title
      toggle.addAction(UIAction { [weak self, weak toggle] _ in
        guard let self, pendingSwipe == nil, rows[key]?.settings?.enabled == true else { return }
        // Block repeated events until React returns the updated control state.
        toggle?.isEnabled = false
        onRowPress(key)
      }, for: .valueChanged)
      // Keep every switch at the trailing edge, including rows with an info action.
      cell.accessories = [.customView(configuration: .init(customView: toggle, placement: .trailing(at: { $0.count })))]
    } else if settings.disclosure {
      cell.accessories = [.outlineDisclosure(options: .init(style: .cell), actionHandler: { [weak self] in
        self?.toggleMember(key)
      })]
    } else {
      cell.accessories = settings.showsDisclosure ? [.disclosureIndicator()] : []
    }
    if !settings.balances.isEmpty {
      let balance = balanceView(settings.balances)
      cell.accessories.insert(.customView(configuration: .init(
        customView: balance, placement: .trailing(),
        reservedLayoutWidth: .custom(balance.bounds.width), maintainsFixedSize: true)), at: 0)
    }
    cell.accessibilityIdentifier = key
  }

  private func balanceView(_ balances: [ActivityBalanceRecord]) -> UIView {
    let stack = UIStackView()
    stack.axis = .vertical
    stack.alignment = .trailing
    stack.spacing = 1
    // The cell owns highlighting and expansion, including taps on the balance.
    stack.isUserInteractionEnabled = false
    let labelFont = UIFontMetrics(forTextStyle: .caption2).scaledFont(
      for: .systemFont(ofSize: 10, weight: .bold), compatibleWith: traitCollection)
    let valueFont = UIFontMetrics(forTextStyle: .subheadline).scaledFont(
      for: .monospacedDigitSystemFont(ofSize: 15, weight: .bold), compatibleWith: traitCollection)
    for balance in balances {
      if let previous = stack.arrangedSubviews.last { stack.setCustomSpacing(4, after: previous) }
      let label = UILabel()
      label.text = balance.label.uppercased()
      label.font = labelFont
      label.textColor = balance.color
      label.textAlignment = .right
      label.adjustsFontForContentSizeCategory = true
      stack.addArrangedSubview(label)
      if !balance.value.isEmpty {
        let value = UILabel()
        value.text = balance.value
        value.font = valueFont
        value.textColor = balance.color
        value.textAlignment = .right
        value.adjustsFontForContentSizeCategory = true
        stack.addArrangedSubview(value)
      }
    }
    let measured = stack.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
    let contentSize = CGSize(width: ceil(measured.width), height: ceil(measured.height))
    stack.frame = CGRect(origin: .zero, size: contentSize)
    // Reserve the whole balance column plus its gap before the native chevron.
    // UIKit otherwise centers a fixed-size stack in its accessory slot, letting
    // wider amounts extend into the outline accessory's frame.
    let container = UIView(frame: CGRect(origin: .zero,
      size: CGSize(width: contentSize.width + 12, height: contentSize.height)))
    container.isUserInteractionEnabled = false
    container.isAccessibilityElement = true
    container.accessibilityLabel = balances.map { [$0.label, $0.value].filter { !$0.isEmpty }.joined(separator: " ") }
      .joined(separator: ", ")
    container.addSubview(stack)
    return container
  }

  private func avatarFallback(_ settings: ActivitySettingsRowRecord, size: CGFloat) -> UIImage? {
    guard let fallback = settings.avatarFallback else { return nil }
    let bounds = CGRect(x: 0, y: 0, width: size, height: size)
    return UIGraphicsImageRenderer(size: bounds.size).image { _ in
      fallback.backgroundColor.setFill()
      let radius = fallback.rounded ? size * 0.28 : size / 2
      UIBezierPath(roundedRect: bounds, cornerRadius: radius).fill()
      if !fallback.initials.isEmpty {
        let text = fallback.initials as NSString
        let attributes: [NSAttributedString.Key: Any] = [
          .font: UIFont.systemFont(ofSize: size * 0.36, weight: .bold),
          .foregroundColor: fallback.foregroundColor,
        ]
        let textSize = text.size(withAttributes: attributes)
        text.draw(at: CGPoint(x: (size - textSize.width) / 2, y: (size - textSize.height) / 2),
          withAttributes: attributes)
      } else if let symbol = UIImage(systemName: settings.symbol,
        withConfiguration: UIImage.SymbolConfiguration(pointSize: size * 0.49, weight: .semibold))?
        .withTintColor(fallback.foregroundColor, renderingMode: .alwaysOriginal) {
        let scale = min(size * 0.55 / symbol.size.width, size * 0.55 / symbol.size.height)
        let width = symbol.size.width * scale
        let height = symbol.size.height * scale
        symbol.draw(in: CGRect(x: (size - width) / 2, y: (size - height) / 2, width: width, height: height))
      }
    }
  }

  private func loadAvatar(_ uri: String) {
    guard avatarLoads[uri] == nil, let url = URL(string: uri),
      url.scheme == "https" || url.scheme == "http" else { return }
    // Only visible cells request photos. Identity checks below prevent a late
    // image from being applied to a cell that has since been reused.
    avatarLoads[uri] = Task { @MainActor [weak self] in
      do {
        let (data, response) = try await URLSession.shared.data(from: url)
        guard !Task.isCancelled, let response = response as? HTTPURLResponse,
          (200..<300).contains(response.statusCode), let photo = UIImage(data: data) else {
          self?.avatarLoads[uri] = nil
          return
        }
        guard let self else { return }
        avatarImages[uri] = photo.preparingThumbnail(of: CGSize(width: 56, height: 56)) ?? photo
        avatarLoads[uri] = nil
        for indexPath in collectionView.indexPathsForVisibleItems {
          guard let key = dataSource.itemIdentifier(for: indexPath),
            let settings = rows[key]?.settings, settings.imageUri == uri,
            let cell = collectionView.cellForItem(at: indexPath) as? UICollectionViewListCell,
            cell.accessibilityIdentifier == key else { continue }
          configureSettingsCell(cell, settings: settings, key: key)
        }
      } catch {
        self?.avatarLoads[uri] = nil
      }
    }
  }

  private func reportHostedWidth(_ key: String, width: CGFloat, measured: Bool = false) {
    if measured {
      measuredWidthKeys.insert(key)
    } else if measuredWidthKeys.contains(key) {
      return
    }
    guard width > 0, hostedWidths[key] != width else { return }
    hostedWidths[key] = width
    onHostedLayout(key, width)
  }

  private func boundary(
    _ content: ActivityHostedContent, kind: String, alignment: NSRectAlignment,
    original: NSCollectionLayoutBoundarySupplementaryItem?
  ) -> NSCollectionLayoutBoundarySupplementaryItem {
    let insets = original?.contentInsets ?? .zero
    let measured = NSCollectionLayoutBoundarySupplementaryItem(
      layoutSize: NSCollectionLayoutSize(
        widthDimension: original?.layoutSize.widthDimension ?? .fractionalWidth(1),
        heightDimension: .absolute(max(1, content.height) + insets.top + insets.bottom)),
      elementKind: kind, alignment: original?.alignment ?? alignment,
      absoluteOffset: original?.offset ?? .zero)
    measured.contentInsets = insets
    measured.edgeSpacing = original?.edgeSpacing
    measured.extendsBoundary = true
    measured.pinToVisibleBounds = false
    measured.zIndex = original?.zIndex ?? 0
    return measured
  }

  private func section(at index: Int) -> ActivitySection? {
    guard let key = dataSource?.sectionIdentifier(for: index) else { return nil }
    return sectionsByKey[key]
  }

  private func updateVisibleSupplementaries() {
    collectionView.collectionViewLayout.invalidateLayout()
    collectionView.layoutIfNeeded()
    for kind in [
      UICollectionView.elementKindSectionHeader, UICollectionView.elementKindSectionFooter,
    ] {
      for indexPath in collectionView.indexPathsForVisibleSupplementaryElements(ofKind: kind) {
        guard let section = section(at: indexPath.section),
          let cell = collectionView.supplementaryView(forElementKind: kind, at: indexPath)
            as? UICollectionViewCell
        else { continue }
        if kind == UICollectionView.elementKindSectionHeader, section.headerTitle != nil {
          configureHeader(cell, section: section)
          continue
        }
        if kind == UICollectionView.elementKindSectionFooter, section.footerTitle != nil {
          configureFooter(cell, section: section)
          continue
        }
        let content =
          kind == UICollectionView.elementKindSectionHeader ? section.header : section.footer
        if let content,
          (cell.contentConfiguration as? ActivityHostedConfiguration)?.content != content
        {
          cell.contentConfiguration = hostedConfiguration(content)
          cell.setNeedsLayout()
        }
      }
    }
  }

  override func collectionView(_ collectionView: UICollectionView, shouldHighlightItemAt indexPath: IndexPath) -> Bool {
    guard pendingSwipe == nil, let key = dataSource.itemIdentifier(for: indexPath) else { return false }
    if let settings = rows[key]?.settings, !settings.enabled || settings.toggleValue != nil { return false }
    return rows[key]?.selectable == true || rows[key]?.settings?.disclosure == true
  }

  override func collectionView(_ collectionView: UICollectionView, shouldSelectItemAt indexPath: IndexPath) -> Bool {
    self.collectionView(collectionView, shouldHighlightItemAt: indexPath)
  }

  override func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    collectionView.deselectItem(at: indexPath, animated: true)
    guard pendingSwipe == nil, let key = dataSource.itemIdentifier(for: indexPath) else { return }
    if rows[key]?.settings?.disclosure == true { toggleMember(key) }
    else if rows[key]?.selectable == true { onRowPress(key) }
  }

  override func collectionView(
    _ collectionView: UICollectionView,
    contextMenuConfigurationForItemsAt indexPaths: [IndexPath], point: CGPoint
  ) -> UIContextMenuConfiguration? {
    guard pendingSwipe == nil, indexPaths.count == 1,
      let indexPath = indexPaths.first,
      let key = dataSource.itemIdentifier(for: indexPath),
      let preview = rows[key]?.preview
    else { return nil }
    return UIContextMenuConfiguration(
      identifier: key as NSString,
      previewProvider: {
        let controller = UIHostingController(rootView: ActivityPreviewCard(preview: preview))
        controller.view.backgroundColor = .secondarySystemGroupedBackground
        let width = min(360, collectionView.bounds.width - 32)
        controller.preferredContentSize = controller.sizeThatFits(
          in: CGSize(width: width, height: CGFloat.greatestFiniteMagnitude))
        return controller
      },
      actionProvider: { [weak self] _ in
        guard let self, let row = self.rows[key] else { return nil }
        if !row.previewActions.isEmpty {
          return UIMenu(children: row.previewActions.map { item in
            var attributes: UIMenuElement.Attributes = []
            if item.destructive { attributes.insert(.destructive) }
            if item.disabled { attributes.insert(.disabled) }
            return UIAction(
              title: item.title, image: UIImage(systemName: item.symbol),
              attributes: attributes
            ) { [weak self] _ in
              guard let self, self.pendingSwipe == nil,
                self.dataSource.indexPath(for: key) != nil,
                let current = self.rows[key]?.previewActions.first(where: { $0.id == item.id }),
                !current.disabled
              else { return }
              self.onPreviewAction(key, item.id)
            }
          })
        }
        return UIMenu(children: [
          UIAction(title: "Open details", image: UIImage(systemName: "arrow.up.right")) {
            [weak self] _ in self?.openPreview(key)
          }
        ])
      })
  }

  override func collectionView(
    _ collectionView: UICollectionView,
    willPerformPreviewActionForMenuWith configuration: UIContextMenuConfiguration,
    animator: any UIContextMenuInteractionCommitAnimating
  ) {
    guard let key = configuration.identifier as? String else { return }
    animator.addCompletion { [weak self] in self?.openPreview(key) }
  }

  private func openPreview(_ key: String) {
    guard pendingSwipe == nil, rows[key]?.preview != nil,
      dataSource.indexPath(for: key) != nil else { return }
    onPreviewOpen(key)
  }

  private func swipeActions(at indexPath: IndexPath) -> UISwipeActionsConfiguration? {
    guard pendingSwipe == nil,
      let key = dataSource.itemIdentifier(for: indexPath),
      let row = rows[key], row.canDelete, !row.deletionDisabled
    else { return nil }
    let delete = UIContextualAction(style: .destructive, title: row.actionTitle) {
      [weak self] _, _, complete in
      guard let self, self.pendingSwipe == nil,
        let row = self.rows[key], !row.deletionDisabled
      else {
        complete(false)
        return
      }
      let requestId = UUID().uuidString
      self.pendingSwipe = (requestId, key, complete)
      self.onDeleteRequested(key, requestId)
      // UIKit owns the entire swipe animation. Complete only after the dialog
      // and mutation resolve, so Cancel restores the row rather than hiding it.
    }
    delete.image = UIImage(systemName: row.actionIcon)
    if let color = row.actionColor { delete.backgroundColor = color }
    let configuration = UISwipeActionsConfiguration(actions: [delete])
    configuration.performsFirstActionWithFullSwipe = true
    return configuration
  }

  func cancelPendingSwipe() {
    avatarLoads.values.forEach { $0.cancel() }
    avatarLoads.removeAll()
    let pending = pendingSwipe
    pendingSwipe = nil
    pending?.complete(false)
  }

  @objc private func refresh() {
    guard pendingRefreshId == nil, !shouldFinishRefresh else { return }
    let requestId = UUID().uuidString
    pendingRefreshId = requestId
    onRefresh(requestId)
  }

  private func finishRefreshIfNotDragging() {
    guard shouldFinishRefresh, !collectionView.isDragging else { return }
    shouldFinishRefresh = false
    refreshControl.endRefreshing()
  }

  override func scrollViewDidEndDragging(
    _ scrollView: UIScrollView, willDecelerate decelerate: Bool
  ) {
    finishRefreshIfNotDragging()
  }

  override func scrollViewDidScroll(_ scrollView: UIScrollView) {
    onScroll([
      "contentOffset": ["x": scrollView.contentOffset.x, "y": scrollView.contentOffset.y],
      "contentInset": [
        "top": scrollView.adjustedContentInset.top,
        "bottom": scrollView.adjustedContentInset.bottom,
        "left": scrollView.adjustedContentInset.left,
        "right": scrollView.adjustedContentInset.right,
      ],
      "contentSize": [
        "width": scrollView.contentSize.width, "height": scrollView.contentSize.height,
      ],
      "layoutMeasurement": ["width": scrollView.bounds.width, "height": scrollView.bounds.height],
      "zoomScale": 1,
    ])
  }
}
